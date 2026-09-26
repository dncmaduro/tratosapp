const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const XLSX = require("xlsx")
const { IncomeImportService } = require("../dist/incomes/income-import.service")

const channelId = "507f1f77bcf86cd799439011"
const baseRow = (id, created) => ({
  "Order ID": id, "Created Time": created, "Seller SKU": "SKU", "Product Name": "Product",
  Quantity: 1, "SKU Subtotal Before Discount": 100, "SKU Subtotal After Discount": 90
})

async function importRows(rows) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Orders")
  const operations = []
  const importer = new IncomeImportService(
    { bulkWrite: async items => { operations.push(...items); return { upsertedCount: items.length, modifiedCount: 0 } }, updateOne: async () => ({ modifiedCount: 0 }) },
    { findById: () => ({ lean: async () => null }) }
  )
  await importer.importTotal({ buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) }, channelId)
  return operations.map(operation => operation.updateOne.update.$set)
}

test("income import interprets Excel serial dates as Vietnam business time regardless of server timezone", async () => {
  const [income] = await importRows([baseRow("serial", 46291.5)])
  assert.equal(income.date.toISOString(), "2026-09-26T05:00:00.000Z")
})

test("income import accepts TikTok day-first and timezone-qualified ISO created times", async () => {
  const [dayFirst, iso, localIso] = await importRows([
    baseRow("day-first", "26/09/2026 10:15:30"),
    baseRow("iso", "2026-09-26T10:15:30+07:00"),
    baseRow("local-iso", "2026-09-26T10:15:30.123")
  ])
  assert.equal(dayFirst.date.toISOString(), "2026-09-26T03:15:30.000Z")
  assert.equal(iso.date.toISOString(), "2026-09-26T03:15:30.000Z")
  assert.equal(localIso.date.toISOString(), "2026-09-26T03:15:30.123Z")
})

test("income import rejects invalid calendar dates instead of silently assigning a different day", async () => {
  await assert.rejects(importRows([baseRow("invalid", "31/02/2026 10:00:00")]), error => error.getStatus?.() === 400)
})
