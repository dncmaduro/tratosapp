const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { IncomesController } = require("../dist/incomes/incomes.controller")

const channelId = "507f1f77bcf86cd799439011"
const status = code => error => error.getStatus?.() === code
const file = (name = "orders.xlsx") => ({ originalname: name, buffer: Buffer.from("spreadsheet") })

function setup(channelExists = true) {
  const calls = { exists: [], total: [], affiliate: [], status: [] }
  const channels = { exists: async filter => { calls.exists.push(filter); return channelExists ? { _id: channelId } : null } }
  const importer = {
    importTotal: async (...args) => { calls.total.push(args); return { importedOrders: 1, updatedOrders: 0 } },
    importAffiliate: async (...args) => { calls.affiliate.push(args); return { updated: 2 } },
    updateStatuses: async (...args) => { calls.status.push(args); return { updated: 3 } }
  }
  return { controller: new IncomesController({}, {}, {}, channels, importer), calls }
}

test("income import preserves all four supported modes with their expected files", async () => {
  const f = setup()
  const full = await f.controller.import([file("orders.xlsx"), file("affiliate.csv")], channelId, "full", undefined, undefined)
  assert.deepEqual(full, { success: true, message: "Đã import doanh thu", importedOrders: 1, updatedOrders: 0, affiliateUpdated: 2 })
  const base = await f.controller.import([file("orders.xls")], channelId, "base-only", "0", "2")
  assert.deepEqual(base, { success: true, message: "Đã import doanh thu", importedOrders: 1, updatedOrders: 0, affiliateUpdated: 0 })
  const affiliate = await f.controller.import([file("affiliate.xlsx")], channelId, "affiliate-only", "1", "2")
  assert.deepEqual(affiliate, { success: true, message: "Đã cập nhật affiliate", updated: 2 })
  const statuses = await f.controller.import([file("orders.csv")], channelId, "status-only", "0", "1")
  assert.deepEqual(statuses, { success: true, message: "Đã cập nhật trạng thái", updated: 3 })
  assert.equal(f.calls.total.length, 2)
  assert.equal(f.calls.affiliate.length, 2)
  assert.equal(f.calls.status.length, 1)
  assert.ok(f.calls.exists.every(call => call._id === channelId))
})

test("income import rejects invalid modes, channel ids, file counts, types and chunks before database work", async () => {
  const f = setup()
  const cases = [
    [[], channelId, "status-only"], [[file()], "invalid", "status-only"], [[file()], channelId, "unknown"],
    [[file()], channelId, "full"], [[file(), file()], channelId, "base-only"], [[file("orders.pdf")], channelId, "status-only"],
    [[{ originalname: "orders.xlsx", buffer: Buffer.alloc(0) }], channelId, "status-only"],
    [[file()], channelId, "status-only", "1", "1"], [[file()], channelId, "status-only", "oops", "1"],
    [[file()], channelId, "status-only", "0", undefined]
  ]
  for (const args of cases) await assert.rejects(f.controller.import(...args), status(400))
  assert.deepEqual(f.calls.exists, [])
  assert.deepEqual(f.calls.total, [])
  assert.deepEqual(f.calls.affiliate, [])
  assert.deepEqual(f.calls.status, [])
})

test("income import rejects a well-formed request for a missing channel before parsing files", async () => {
  const f = setup(false)
  await assert.rejects(f.controller.import([file()], channelId, "status-only", undefined, undefined), status(404))
  assert.equal(f.calls.exists.length, 1)
  assert.deepEqual(f.calls.status, [])
})
