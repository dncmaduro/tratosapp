const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { IncomesController } = require("../dist/incomes/incomes.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code

function query(result = []) {
  return {
    sort() { return this },
    skip() { return this },
    limit() { return this },
    populate() { return this },
    lean: async () => result
  }
}

function setup() {
  const calls = { incomeFind: [], metricFind: [], deleted: [] }
  const incomes = {
    find: filter => { calls.incomeFind.push(filter); return query() },
    countDocuments: async () => 0,
    deleteMany: async filter => { calls.deleted.push(filter); return { deletedCount: 0 } }
  }
  const metrics = { find: filter => { calls.metricFind.push(filter); return query() } }
  const goals = { findOne: () => ({ lean: async () => null }) }
  return { controller: new IncomesController(incomes, metrics, goals, {}, {}), calls }
}

test("income date-only queries use the complete Vietnam business day", async () => {
  const f = setup()
  await f.controller.list(channelId, "2026-09-26", "2026-09-26", undefined, undefined, "1", "10", "")
  const date = f.calls.incomeFind[0].date
  assert.equal(date.$gte.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.equal(date.$lte.toISOString(), "2026-09-26T16:59:59.999Z")

  await f.controller.removeByDate("2026-09-26", channelId)
  const removed = f.calls.deleted[0].date
  assert.equal(removed.$gte.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.equal(removed.$lt.toISOString(), "2026-09-26T17:00:00.000Z")
})

test("income monthly reports query Vietnam month boundaries", async () => {
  const f = setup()
  await f.controller.monthlyIncome("8", "2026", channelId)
  const date = f.calls.incomeFind[0].date
  assert.equal(date.$gte.toISOString(), "2026-08-31T17:00:00.000Z")
  assert.equal(date.$lt.toISOString(), "2026-09-30T17:00:00.000Z")

  await f.controller.monthlyAds("8", "2026", channelId)
  assert.equal(f.calls.metricFind[0].date.$gte.toISOString(), "2026-08-31T17:00:00.000Z")
  assert.equal(f.calls.metricFind[0].date.$lte.toISOString(), "2026-09-30T16:59:59.999Z")
})

test("income queries reject malformed ranges, IDs and pagination before database reads", async () => {
  const f = setup()
  await assert.rejects(f.controller.list("not-an-id", undefined, undefined, undefined, undefined, "1", "10", ""), status(400))
  await assert.rejects(f.controller.list(channelId, "2026-02-30", undefined, undefined, undefined, "1", "10", ""), status(400))
  await assert.rejects(f.controller.list(channelId, undefined, undefined, undefined, undefined, "0", "10", ""), status(400))
  await assert.rejects(f.controller.monthlyIncome("12", "2026", channelId), status(400))
  await assert.rejects(f.controller.removeByDate("2026-02-30", channelId), status(400))
  assert.deepEqual(f.calls.incomeFind, [])
  assert.deepEqual(f.calls.deleted, [])
})

test("income search treats special characters as literal text", async () => {
  const f = setup()
  await f.controller.list(channelId, undefined, undefined, undefined, undefined, "1", "10", ".*")
  const filters = f.calls.incomeFind[0].$or
  assert.equal(filters[0].orderId.$regex, "\\.\\*")
  assert.equal(filters[1].customer.$regex, "\\.\\*")
})
