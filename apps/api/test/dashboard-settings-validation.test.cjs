const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { MonthGoalsController } = require("../dist/month-goals/month-goals.controller")
const { PackingRulesController } = require("../dist/packing-rules/packing-rules.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const goal = () => ({
  month: 8, year: 2026, channel: channelId,
  liveStreamGoal: 1_000_000, shopGoal: 2_000_000,
  liveAdsPercentageGoal: 15, shopAdsPercentageGoal: 20
})
const rule = () => ({
  packingType: "small",
  products: [{ productCode: "SKU-1", minQuantity: 1, maxQuantity: 5 }]
})

function monthGoals(channelExists = true) {
  const calls = { exists: [], create: [], update: [] }
  const goals = {
    create: async value => { calls.create.push(value); return value },
    findOneAndUpdate: async (...args) => { calls.update.push(args); return args[1].$set }
  }
  const channels = { exists: async value => { calls.exists.push(value); return channelExists ? { _id: channelId } : null } }
  return { controller: new MonthGoalsController(goals, channels), calls, goals }
}

function packingRules() {
  const calls = { create: [], update: [] }
  const rules = {
    create: async value => { calls.create.push(value); return value },
    findOneAndUpdate: async (...args) => { calls.update.push(args); return { ...args[1].$set } }
  }
  return { controller: new PackingRulesController(rules), calls }
}

test("month goals normalize valid data and only write declared fields", async () => {
  const f = monthGoals()
  const created = await f.controller.create(goal())
  assert.equal(created.channel.toString(), channelId)
  assert.deepEqual(Object.keys(created).sort(), [
    "channel", "liveAdsPercentageGoal", "liveStreamGoal", "month", "shopAdsPercentageGoal", "shopGoal", "year"
  ])
  await f.controller.update(goal())
  assert.deepEqual(f.calls.update[0][0], { year: 2026, month: 8, channel: created.channel })
  assert.equal(f.calls.update[0][2].runValidators, true)
})

test("month goals reject bad fields, invalid dates, rates and missing channels before writes", async () => {
  const f = monthGoals()
  const cases = [
    {}, { ...goal(), unsafe: true }, { ...goal(), channel: "invalid" }, { ...goal(), month: 12 },
    { ...goal(), year: 1999 }, { ...goal(), liveStreamGoal: -1 }, { ...goal(), shopAdsPercentageGoal: 101 }
  ]
  for (const value of cases) await assert.rejects(f.controller.create(value), status(400))
  assert.deepEqual(f.calls.exists, [])
  assert.deepEqual(f.calls.create, [])

  const missing = monthGoals(false)
  await assert.rejects(missing.controller.create(goal()), status(404))
  assert.deepEqual(missing.calls.create, [])
})

test("month goals report duplicate month and channel combinations as conflicts", async () => {
  const f = monthGoals()
  f.goals.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(f.controller.create(goal()), status(409))
})

test("packing rules only accept known boxes and consistent product quantity ranges", async () => {
  const f = packingRules()
  const created = await f.controller.create(rule())
  assert.deepEqual(created, rule())
  await f.controller.update("SKU-1", rule())
  assert.deepEqual(f.calls.update[0][0], { "products.productCode": "SKU-1" })
  assert.equal(f.calls.update[0][2].runValidators, true)

  const cases = [
    {}, { ...rule(), extra: true }, { ...rule(), packingType: "unknown" }, { ...rule(), products: [] },
    { ...rule(), products: [{ productCode: "", minQuantity: 1, maxQuantity: 2 }] },
    { ...rule(), products: [{ productCode: "SKU-1", minQuantity: 2, maxQuantity: 1 }] },
    { ...rule(), products: [{ productCode: "SKU-1", minQuantity: 1.5, maxQuantity: null }] },
    { ...rule(), products: [{ productCode: "SKU-1", minQuantity: null, maxQuantity: null }, { productCode: "SKU-1", minQuantity: null, maxQuantity: null }] }
  ]
  for (const value of cases) assert.throws(() => f.controller.create(value), status(400))
  await assert.rejects(f.controller.update("SKU-2", rule()), status(400))
  assert.equal(f.calls.create.length, 1)
  assert.equal(f.calls.update.length, 1)
})
