const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { IncomesController } = require("../dist/incomes/incomes.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const validIncome = () => ({
  orderId: "ORDER-1",
  channel: channelId,
  date: "2026-09-26",
  customer: " buyer ",
  products: [{ code: "SKU-1", name: " Product ", quantity: 2, price: 300000, priceAfterDiscount: 250000 }]
})

function setup(channelExists = true) {
  const calls = { exists: [], create: [] }
  const incomes = { create: async value => { calls.create.push(value); return value } }
  const channels = { exists: async value => { calls.exists.push(value); return channelExists ? { _id: channelId } : null } }
  return { controller: new IncomesController(incomes, {}, {}, channels, {}), calls, incomes }
}

test("manual income creation writes only the documented normalized fields", async () => {
  const f = setup()
  await f.controller.create(validIncome())
  assert.equal(f.calls.create.length, 1)
  const income = f.calls.create[0]
  assert.equal(income.orderId, "ORDER-1")
  assert.equal(income.customer, "buyer")
  assert.equal(income.channel.toString(), channelId)
  assert.equal(income.date.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.deepEqual(income.products, [{
    code: "SKU-1", name: "Product", source: "other", sourceChecked: false,
    creator: "", content: "", affiliateAdsPercentage: 0, affiliateAdsAmount: 0,
    standardAffPercentage: 0, standardAffAmount: 0, quantity: 2,
    price: 300000, priceAfterDiscount: 250000
  }])
})

test("manual income creation rejects unsafe and malformed input before database work", async () => {
  const f = setup()
  const cases = [
    {}, { ...validIncome(), injected: true }, { ...validIncome(), channel: "not-an-id" },
    { ...validIncome(), date: "2026-02-30" }, { ...validIncome(), products: [] },
    { ...validIncome(), products: [{ ...validIncome().products[0], source: "shopee" }] },
    { ...validIncome(), products: [{ ...validIncome().products[0], quantity: 1.5 }] },
    { ...validIncome(), products: [{ ...validIncome().products[0], price: -1 }] },
    { ...validIncome(), products: [{ ...validIncome().products[0], sourceChecked: "yes" }] }
  ]
  for (const input of cases) await assert.rejects(f.controller.create(input), status(400))
  assert.deepEqual(f.calls.exists, [])
  assert.deepEqual(f.calls.create, [])
})

test("manual income creation reports missing channels and duplicate orders", async () => {
  const missing = setup(false)
  await assert.rejects(missing.controller.create(validIncome()), status(404))
  assert.equal(missing.calls.create.length, 0)

  const duplicate = setup()
  duplicate.incomes.create = async () => { const error = new Error("duplicate"); error.code = 11000; throw error }
  await assert.rejects(duplicate.controller.create(validIncome()), status(409))
})
