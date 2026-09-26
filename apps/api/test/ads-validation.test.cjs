const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { AdsController } = require("../dist/ads/ads.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const validInput = () => ({
  date: "2026-09-26", channelId, roiProtect: 100, tinRefundAmount: 200,
  gmvAds: 1000, affiliateCost: 50, totalRevenue: 2000, refundCancelRate: 25
})

function setup() {
  const calls = { upsert: [], find: [], remove: [] }
  const metrics = {
    findOneAndUpdate: async (...args) => { calls.upsert.push(args); return { _id: "metric" } },
    findOne: (...args) => { calls.find.push(args); return { lean: async () => null } },
    deleteOne: async (...args) => { calls.remove.push(args); return { deletedCount: 1 } }
  }
  return { controller: new AdsController(metrics), calls }
}

test("ads metrics accepts the documented six inputs and preserves the approved formula", async () => {
  const f = setup()
  const result = await f.controller.upsert(validInput())
  assert.deepEqual(result, { success: true, data: { _id: "metric" } })
  const [filter, update, options] = f.calls.upsert[0]
  assert.equal(filter.channel.toString(), channelId)
  assert.equal(filter.date.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.deepEqual(options, { upsert: true, new: true })
  assert.equal(update.$set.refundCancelRate, 25)
  assert.equal(update.$set.actualAdsCost, 700)
  assert.equal(update.$set.affiliateRefundAmount, 175)
  assert.equal(update.$set.totalCost, 750)
  assert.equal(update.$set.adjustedRevenue, 1500)
  assert.equal(update.$set.costAfterRefund, 575)
  assert.equal(update.$set.adsRatioOnBeforeDiscountRevenue, 35)
  assert.equal(update.$set.totalCostRatioOnBeforeDiscountRevenue, 37.5)
  assert.equal(update.$set.costAfterRefundRatioOnBeforeDiscountRevenue, 50)
})

test("ads metrics rejects missing, unsafe and non-finite input before writing", async () => {
  const f = setup()
  const cases = [
    {}, { ...validInput(), gmvAds: undefined }, { ...validInput(), affiliateCost: -1 },
    { ...validInput(), totalRevenue: "NaN" }, { ...validInput(), roiProtect: Infinity },
    { ...validInput(), date: "not-a-date" }, { ...validInput(), channelId: "invalid" },
    { ...validInput(), oldFormulaField: 1 }
  ]
  for (const body of cases) await assert.rejects(f.controller.upsert(body), status(400))
  assert.deepEqual(f.calls.upsert, [])
})

test("percent or decimal refund inputs are normalized and calendar days use Vietnam time", async () => {
  const f = setup()
  await f.controller.upsert({ ...validInput(), date: "2026-09-25T17:00:00.000Z", refundCancelRate: 0.1 })
  assert.equal(f.calls.upsert[0][0].date.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.equal(f.calls.upsert[0][1].$set.refundCancelRate, 10)
  await f.controller.upsert({ ...validInput(), refundCancelRate: 300 })
  assert.equal(f.calls.upsert[1][1].$set.refundCancelRate, 100)
})

test("read and delete validate the date and channel before querying", async () => {
  const f = setup()
  await assert.rejects(f.controller.get("not-a-date", channelId), status(400))
  await assert.rejects(f.controller.get("2026-09-26", "invalid"), status(400))
  await assert.rejects(f.controller.remove({ date: "not-a-date", channelId }), status(400))
  await assert.rejects(f.controller.remove({ date: "2026-09-26", channelId, force: true }), status(400))
  assert.deepEqual(f.calls.find, [])
  assert.deepEqual(f.calls.remove, [])
})
