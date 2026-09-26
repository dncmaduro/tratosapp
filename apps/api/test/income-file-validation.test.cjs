const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const XLSX = require("xlsx")
const { IncomeImportService } = require("../dist/incomes/income-import.service")

const channelId = "507f1f77bcf86cd799439011"
const totalRow = (overrides = {}) => ({
  "Order ID": "ORDER-1", "Created Time": "26/09/2026 10:00:00", "Seller SKU": "SKU-1",
  "Product Name": "Product", Quantity: "3", "SKU Subtotal Before Discount": "1,234.56",
  "SKU Subtotal After Discount": "1.000,50", ...overrides
})

function file(rows) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Orders")
  return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) }
}

function setup() {
  const writes = []
  const importer = new IncomeImportService(
    { bulkWrite: async items => { writes.push(...items); return { upsertedCount: items.length, modifiedCount: 0 } }, updateOne: async () => ({ modifiedCount: 0 }) },
    { findById: () => ({ lean: async () => ({ username: "shop", usernames: [] }) }) }
  )
  return { importer, writes }
}

test("income import normalizes BOM/whitespace headers and common Vietnamese or international money formats", async () => {
  const f = setup()
  const row = totalRow()
  const renamed = Object.fromEntries(Object.entries(row).map(([key, value]) => [key === "Order ID" ? "\uFEFF Order ID " : ` ${key} `, value]))
  await f.importer.importTotal(file([renamed]), channelId)
  const product = f.writes[0].updateOne.update.$set.products[0]
  assert.equal(product.quantity, 3)
  assert.equal(product.price, 1234.56)
  assert.equal(product.priceAfterDiscount, 1000.5)
})

test("income import rejects missing required headers and invalid total line values before any write", async () => {
  const f = setup()
  const withoutDate = totalRow()
  delete withoutDate["Created Time"]
  await assert.rejects(f.importer.importTotal(file([withoutDate]), channelId), error => error.getStatus?.() === 400)
  await assert.rejects(f.importer.importTotal(file([totalRow({ Quantity: "0" })]), channelId), error => error.getStatus?.() === 400)
  await assert.rejects(f.importer.importTotal(file([totalRow({ "SKU Subtotal Before Discount": "not-money" })]), channelId), error => error.getStatus?.() === 400)
  assert.deepEqual(f.writes, [])
})

test("affiliate and status imports reject a file of the wrong type before querying or updating data", async () => {
  const f = setup()
  await assert.rejects(f.importer.importAffiliate(file([{ "Order ID": "ORDER-1", Quantity: 1 }]), channelId), error => error.getStatus?.() === 400)
  await assert.rejects(f.importer.updateStatuses(file([{ "Order ID": "ORDER-1", "Order Status": "Delivered" }]), channelId), error => error.getStatus?.() === 400)
  assert.deepEqual(f.writes, [])
})
