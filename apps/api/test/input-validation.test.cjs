const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { AuthController } = require("../dist/auth/auth.controller")
const { ChannelsController } = require("../dist/channels/channels.controller")

const status = code => error => error.getStatus?.() === code
const userId = "507f1f77bcf86cd799439011"

function channelController() {
  const calls = { create: [], update: [], find: [] }
  const channels = {
    create: async data => { calls.create.push(data); return data },
    findById: id => { calls.find.push(id); return { lean: async () => null } },
    findByIdAndUpdate: (id, update, options) => {
      calls.update.push({ id, update, options })
      return { lean: async () => ({ _id: id, ...update.$set }) }
    },
    findByIdAndDelete: () => ({ lean: async () => null })
  }
  return { controller: new ChannelsController(channels), calls }
}

function authController() {
  const calls = { login: [], profile: [], create: [], active: [], permissions: [] }
  const auth = {
    login: async (...args) => { calls.login.push(args); return { ok: true } },
    refresh: async () => ({ ok: true }),
    check: async () => ({ valid: false }),
    me: async () => ({}),
    changePassword: async () => ({ ok: true }),
    updateProfile: async (...args) => { calls.profile.push(args); return { ok: true } }
  }
  const users = {
    create: async data => { calls.create.push(data); return { id: userId, email: data.email, name: data.name } },
    findByIdAndUpdate: async (id, data, options) => {
      if (id === "507f1f77bcf86cd799439010") return null
      if ("active" in data) calls.active.push({ id, data, options })
      else calls.permissions.push({ id, data, options })
      return { id, active: data.active, permissions: data.permissions }
    },
    find: () => ({ select: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) }),
    countDocuments: async () => 0
  }
  return { controller: new AuthController(auth, users), calls }
}

test("channel input accepts the existing TikTok Shop form and only writes allowed fields", async () => {
  const f = channelController()
  const created = await f.controller.create({
    name: " Tratos Official ", username: " tratos.official ", link: "", platform: "tiktokshop"
  })
  assert.deepEqual(created, {
    name: "Tratos Official", username: "tratos.official", usernames: ["tratos.official"], platform: "tiktokshop", link: ""
  })
  await f.controller.update(userId, { name: "Updated" })
  assert.deepEqual(f.calls.update[0], {
    id: userId, update: { $set: { name: "Updated" } }, options: { new: true, runValidators: true }
  })
})

test("channel input rejects unsafe fields and malformed values before database writes", async () => {
  const f = channelController()
  const invalidBodies = [
    {}, { name: "A", username: "a", platform: "shopee" }, { name: "A", username: "a", owner: "attacker" },
    { name: "A", username: "a", link: "javascript:alert(1)" }, { name: "A", username: "a", usernames: [""] },
    { name: "A", username: "a", sortOrder: 1.2 }
  ]
  for (const body of invalidBodies) await assert.rejects(f.controller.create(body), status(400))
  await assert.rejects(f.controller.update("not-an-id", { name: "Updated" }), status(400))
  await assert.rejects(f.controller.update(userId, {}), status(400))
  assert.deepEqual(f.calls.create, [])
  assert.deepEqual(f.calls.update, [])
})

test("duplicate channel usernames become a 409 response", async () => {
  const f = channelController()
  f.controller.channels.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(f.controller.create({ name: "A", username: "a" }), status(409))
})

test("login and self-service profile endpoints accept only their documented fields", async () => {
  const f = authController()
  await f.controller.login({ username: " USER@EXAMPLE.COM ", password: "password" })
  assert.deepEqual(f.calls.login, [["user@example.com", "password"]])
  for (const body of [
    { username: "user@example.com", password: "password", permissions: ["*"] },
    { username: "not-an-email", password: "password" },
    { username: "user@example.com", password: "" }
  ]) assert.throws(() => f.controller.login(body), error => [400, 401].includes(error.getStatus?.()))
  await f.controller.update({ user: { sub: userId } }, { name: " Tratos User " })
  assert.deepEqual(f.calls.profile[0], [userId, { name: "Tratos User" }])
  for (const body of [{ permissions: ["*"] }, { name: "", active: true }, {}]) {
    assert.throws(() => f.controller.update({ user: { sub: userId } }, body), status(400))
  }
  assert.throws(() => f.controller.avatar({ user: { sub: userId } }, { avatarUrl: "file:///private/a.png" }), status(400))
})

test("admin user mutations validate identifiers, fields and assignable permissions", async () => {
  const f = authController()
  const created = await f.controller.create({
    email: " NEW@EXAMPLE.COM ", name: " New User ", password: "safe-password", permissions: ["api.storageitems.create-item", "api.storageitems.create-item"]
  })
  assert.deepEqual(created, { _id: userId, email: "new@example.com", name: "New User" })
  assert.deepEqual(f.calls.create[0].permissions, ["api.storageitems.create-item"])
  f.controller.users.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(
    f.controller.create({ email: "new@example.com", name: "New User", password: "safe-password" }),
    status(409)
  )
  for (const body of [
    { email: "bad", name: "New", password: "safe-password" }, { email: "n@example.com", name: "", password: "safe-password" },
    { email: "n@example.com", name: "New", password: "short" }, { email: "n@example.com", name: "New", password: "safe-password", permissions: ["unknown.permission"] },
    { email: "n@example.com", name: "New", password: "safe-password", active: false }
  ]) await assert.rejects(f.controller.create(body), status(400))
  await assert.rejects(f.controller.active("invalid", { active: true }), status(400))
  await assert.rejects(f.controller.active(userId, { active: "yes" }), status(400))
  await assert.rejects(f.controller.setPermissions(userId, { permissions: ["unknown.permission"] }), status(400))
  await assert.rejects(f.controller.setPermissions(userId, { permissions: "*" }), status(400))
  assert.deepEqual(f.calls.active, [])
  assert.deepEqual(f.calls.permissions, [])
})

test("admin mutations report missing users rather than a false success", async () => {
  const f = authController()
  const missingId = "507f1f77bcf86cd799439010"
  await assert.rejects(f.controller.active(missingId, { active: false }), status(404))
  await assert.rejects(f.controller.setPermissions(missingId, { permissions: [] }), status(404))
})
