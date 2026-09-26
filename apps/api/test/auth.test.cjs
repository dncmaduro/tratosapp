const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { JwtService } = require("@nestjs/jwt")
const { AuthService } = require("../dist/auth/auth.service")
const { JwtAuthGuard } = require("../dist/auth/jwt-auth.guard")

const userId = "507f1f77bcf86cd799439011"

function setup() {
  const jwt = new JwtService({ secret: "auth-regression-test-only" })
  let user = { id: userId, active: true, email: "test@example.com" }
  let lookups = 0
  const users = { findById: async () => { lookups++; return user } }
  const auth = new AuthService(users, jwt)
  const guard = new JwtAuthGuard(auth)
  const sign = (type, extra = {}, options = {}) => jwt.sign(
    { sub: userId, ...(type ? { type } : {}), ...extra },
    { expiresIn: "15m", ...options }
  )
  const request = (authorization) => {
    const req = { headers: { authorization } }
    return { req, context: { switchToHttp: () => ({ getRequest: () => req }) } }
  }
  return { auth, guard, sign, request, setUser: value => { user = value }, lookups: () => lookups }
}

const unauthorized = error => error.getStatus?.() === 401

test("active user's access token passes both guard and check-token", async () => {
  const f = setup()
  const token = f.sign("access")
  const { req, context } = f.request(`Bearer ${token}`)
  assert.equal(await f.guard.canActivate(context), true)
  assert.equal(req.user.sub, userId)
  assert.deepEqual(await f.auth.check(token), { valid: true })
})

test("refresh, legacy, expired, tampered and malformed-sub tokens cannot authorize API requests", async () => {
  const f = setup()
  for (const token of [f.sign("refresh"), f.sign(), f.sign("access", {}, { expiresIn: -1 }),
    `${f.sign("access")}bad`, f.sign("access", { sub: "invalid" }), f.sign("access", { sub: null })]) {
    await assert.rejects(f.guard.canActivate(f.request(`Bearer ${token}`).context), unauthorized)
    assert.deepEqual(await f.auth.check(token), { valid: false })
  }
  assert.equal(f.lookups(), 0)
})

test("missing or malformed authorization headers return 401", async () => {
  const f = setup()
  for (const header of [undefined, "", "Bearer ", "Basic abc", ["Bearer abc"]]) {
    await assert.rejects(f.guard.canActivate(f.request(header).context), unauthorized)
  }
})

test("locking or deleting an account invalidates an already-issued access and refresh token", async () => {
  const f = setup()
  const access = f.sign("access")
  const refresh = f.sign("refresh")
  await f.guard.canActivate(f.request(`Bearer ${access}`).context)
  for (const user of [{ id: userId, active: false }, null]) {
    f.setUser(user)
    await assert.rejects(f.guard.canActivate(f.request(`Bearer ${access}`).context), unauthorized)
    assert.deepEqual(await f.auth.check(access), { valid: false })
    await assert.rejects(f.auth.refresh(refresh), unauthorized)
  }
})

test("refresh accepts only refresh tokens and issues usable, distinct token types", async () => {
  const f = setup()
  await assert.rejects(f.auth.refresh(f.sign("access")), unauthorized)
  const tokens = await f.auth.refresh(f.sign("refresh"))
  assert.deepEqual(await f.auth.check(tokens.accessToken), { valid: true })
  assert.deepEqual(await f.auth.check(tokens.refreshToken), { valid: false })
  assert.equal(await f.guard.canActivate(f.request(`Bearer ${tokens.accessToken}`).context), true)
})
