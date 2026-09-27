const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { Reflector } = require("@nestjs/core")
const { GUARDS_METADATA } = require("@nestjs/common/constants")
const { PermissionsGuard } = require("../dist/auth/permissions.guard")
const { JwtAuthGuard } = require("../dist/auth/jwt-auth.guard")
const { PERMISSIONS_KEY } = require("../dist/auth/require-permissions.decorator")
const { AuthController } = require("../dist/auth/auth.controller")
const { AdsController } = require("../dist/ads/ads.controller")
const { ChannelsController } = require("../dist/channels/channels.controller")
const { IncomesController } = require("../dist/incomes/incomes.controller")
const { MonthGoalsController } = require("../dist/month-goals/month-goals.controller")
const { PackingRulesController } = require("../dist/packing-rules/packing-rules.controller")
const { StorageItemsController } = require("../dist/storage-items/storage-items.controller")

const protectedWrites = [
  [ChannelsController, "create", "api.livestreamchannels.create-livestream-channel"],
  [ChannelsController, "update", "api.livestreamchannels.update-livestream-channel"],
  [ChannelsController, "remove", "api.livestreamchannels.delete-livestream-channel"],
  [StorageItemsController, "create", "api.storageitems.create-item"]
]
const protectedIncomeReads = [
  "list", "monthlyIncome", "monthlyQuantity", "kpiPercentage", "monthlyAds", "rangeStats", "export"
].map(method => [IncomesController, method, "api.incomes.get-incomes-by-date-range"])
const protectedIncomeSupportReads = [
  [AdsController, "get"], [MonthGoalsController, "list"], [MonthGoalsController, "get"], [PackingRulesController, "list"]
].map(([Controller, method]) => [Controller, method, "api.incomes.get-incomes-by-date-range"])
const reflector = new Reflector()
const forbidden = error => error.getStatus?.() === 403
function context(Controller, method, user = { sub: "507f1f77bcf86cd799439011" }) {
  return {
    getClass: () => Controller,
    getHandler: () => Controller.prototype[method],
    switchToHttp: () => ({ getRequest: () => ({ user }) })
  }
}
function setup() {
  let user = { active: true, permissions: [] }
  const users = { findById: () => ({ select: () => ({ lean: async () => user }) }) }
  return {
    guard: new PermissionsGuard(reflector, users),
    setUser: value => { user = value }
  }
}

test("protected writes and income reads declare both guards and their permission keys", () => {
  for (const [Controller, method, permission] of [...protectedWrites, ...protectedIncomeReads, ...protectedIncomeSupportReads]) {
    const targets = [Controller.prototype[method], Controller]
    assert.deepEqual(reflector.getAllAndOverride(GUARDS_METADATA, targets), [JwtAuthGuard, PermissionsGuard])
    assert.deepEqual(reflector.getAllAndOverride(PERMISSIONS_KEY, targets), [permission])
  }
})

test("write and income-read permissions are assignable through the admin permission catalogue", () => {
  const keys = new AuthController({}, {}).permissions().data.map(item => item.key)
  for (const [, , permission] of [...protectedWrites, ...protectedIncomeReads, ...protectedIncomeSupportReads]) assert.ok(keys.includes(permission), permission)
  assert.equal(new Set(keys).size, keys.length)
})

test("writes reject missing or unrelated permissions but allow the exact key and wildcard", async () => {
  const f = setup()
  for (const [Controller, method, permission] of protectedWrites) {
    const ctx = context(Controller, method)
    for (const permissions of [[], ["api.products.search-products"]]) {
      f.setUser({ active: true, permissions })
      await assert.rejects(f.guard.canActivate(ctx), forbidden)
    }
    for (const permissions of [[permission], ["*"]]) {
      f.setUser({ active: true, permissions })
      assert.equal(await f.guard.canActivate(ctx), true)
    }
  }
})

test("income reads reject missing permissions but allow their exact key and wildcard", async () => {
  const f = setup()
  for (const [Controller, method, permission] of [...protectedIncomeReads, ...protectedIncomeSupportReads]) {
    const ctx = context(Controller, method)
    for (const permissions of [[], ["api.products.search-products"]]) {
      f.setUser({ active: true, permissions })
      await assert.rejects(f.guard.canActivate(ctx), forbidden)
    }
    for (const permissions of [[permission], ["*"]]) {
      f.setUser({ active: true, permissions })
      assert.equal(await f.guard.canActivate(ctx), true)
    }
  }
})

test("revoking a permission or disabling/deleting its account blocks the next write", async () => {
  const f = setup()
  for (const [Controller, method, permission] of protectedWrites) {
    const ctx = context(Controller, method)
    f.setUser({ active: true, permissions: [permission] })
    assert.equal(await f.guard.canActivate(ctx), true)
    for (const user of [{ active: true, permissions: [] }, { active: false, permissions: ["*"] }, null]) {
      f.setUser(user)
      await assert.rejects(f.guard.canActivate(ctx), forbidden)
    }
    await assert.rejects(f.guard.canActivate(context(Controller, method, null)), forbidden)
  }
})

test("channel and storage reads remain available without a write permission", async () => {
  const f = setup()
  for (const [Controller, method] of [
    [ChannelsController, "list"], [ChannelsController, "detail"], [StorageItemsController, "search"]
  ]) {
    assert.ok(Reflect.getMetadata(GUARDS_METADATA, Controller).includes(JwtAuthGuard))
    assert.equal(await f.guard.canActivate(context(Controller, method)), true)
  }
})
