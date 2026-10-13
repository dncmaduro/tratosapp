const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { BookingsController } = require("../dist/bookings/bookings.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const validInput = () => ({
  date: "2026-09-26",
  channelId,
  type: "freecast",
  kocCount: 12,
  productShippingCost: 1250000,
  castFee: 0
})

function setup(existing = []) {
  const calls = { upsert: [], find: [], remove: [] }
  const metrics = {
    findOneAndUpdate: async (...args) => {
      calls.upsert.push(args)
      return { _id: "metric" }
    },
    find: (...args) => {
      calls.find.push(args)
      return {
        sort: () => ({ lean: async () => existing })
      }
    },
    deleteOne: async (...args) => {
      calls.remove.push(args)
      return { deletedCount: 1 }
    }
  }
  return { controller: new BookingsController(metrics), calls }
}

test("booking metrics accepts both booking types and stores one daily record per type", async () => {
  const f = setup()
  const result = await f.controller.upsert(validInput())
  assert.deepEqual(result, { success: true, data: { _id: "metric" } })
  const [filter, update, options] = f.calls.upsert[0]
  assert.equal(filter.channel.toString(), channelId)
  assert.equal(filter.date.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.equal(filter.type, "freecast")
  assert.equal(update.$set.kocCount, 12)
  assert.equal(update.$set.productShippingCost, 1250000)
  assert.equal(update.$set.castFee, 0)
  assert.deepEqual(options, { upsert: true, new: true })

  await f.controller.upsert({ ...validInput(), type: "paid_cast", castFee: 500000 })
  assert.equal(f.calls.upsert[1][0].type, "paid_cast")
  assert.equal(f.calls.upsert[1][1].$set.castFee, 500000)
})

test("booking metrics rejects unsafe input before writing", async () => {
  const f = setup()
  const cases = [
    {},
    { ...validInput(), type: "paid-cast" },
    { ...validInput(), kocCount: -1 },
    { ...validInput(), productShippingCost: "NaN" },
    { ...validInput(), castFee: Infinity },
    { ...validInput(), date: "not-a-date" },
    { ...validInput(), channelId: "invalid" },
    { ...validInput(), unexpected: true }
  ]
  for (const body of cases) await assert.rejects(f.controller.upsert(body), status(400))
  assert.deepEqual(f.calls.upsert, [])
})

test("booking metrics range and delete validate calendar days and type", async () => {
  const f = setup([{ _id: "metric" }])
  const result = await f.controller.get(channelId, "2026-09-01", "2026-09-30")
  assert.deepEqual(result, { data: [{ _id: "metric" }] })
  const [filter] = f.calls.find[0]
  assert.equal(filter.channel.toString(), channelId)
  assert.equal(filter.date.$gte.toISOString(), "2026-08-31T17:00:00.000Z")
  assert.equal(filter.date.$lte.toISOString(), "2026-09-29T17:00:00.000Z")

  await f.controller.remove({ date: "2026-09-26", channelId, type: "paid_cast" })
  const [deleteFilter] = f.calls.remove[0]
  assert.equal(deleteFilter.type, "paid_cast")

  await assert.rejects(f.controller.get(channelId, "2026-10-01", "2026-09-30"), status(400))
  await assert.rejects(f.controller.remove({ date: "2026-09-26", channelId }), status(400))
  assert.equal(f.calls.remove.length, 1)
})
