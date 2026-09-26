const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const XLSX = require("xlsx")
const { IncomeImportService } = require("../dist/incomes/income-import.service")

const channelId = "507f1f77bcf86cd799439011"
const affiliateRow = (overrides = {}) => ({
  "ID đơn hàng": "ORDER-1", "Sku người bán": "SKU-1", "Số lượng": 2,
  "Tên người dùng nhà sáng tạo": "creator", "Loại nội dung": "Video",
  "Tỷ lệ hoa hồng tiêu chuẩn": "10", "Hoa hồng tiêu chuẩn": "20", ...overrides
})
const affiliateFile = (rows) => {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Affiliate")
  return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) }
}

test("affiliate import targets every unchecked matching product and leaves checked products untouched on retry", async () => {
  const calls = []
  const importer = new IncomeImportService(
    { updateOne: async (...args) => { calls.push(args); return { modifiedCount: calls.length === 1 ? 1 : 0 } }, bulkWrite: async () => ({}) },
    { findById: () => ({ lean: async () => ({ username: "shop", usernames: [] }) }) }
  )
  const first = await importer.importAffiliate(affiliateFile([affiliateRow()]), channelId)
  const second = await importer.importAffiliate(affiliateFile([affiliateRow()]), channelId)
  assert.deepEqual(first, { updated: 1 })
  assert.deepEqual(second, { updated: 0 })
  const [filter, update, options] = calls[0]
  assert.equal(filter.orderId, "ORDER-1")
  assert.equal(filter.channel.toString(), channelId)
  assert.deepEqual(filter.products.$elemMatch, { code: "SKU-1", quantity: 2, sourceChecked: false })
  assert.deepEqual(options, { arrayFilters: [{ "product.code": "SKU-1", "product.quantity": 2, "product.sourceChecked": false }] })
  assert.equal(update.$set["products.$[product].sourceChecked"], true)
  assert.equal(update.$set["products.$[product].source"], "affiliate")
  assert.equal(update.$set["products.$.sourceChecked"], undefined)
})

test("affiliate import uses the same unchecked filter for every matching line in a duplicate-SKU order", async () => {
  const calls = []
  const importer = new IncomeImportService(
    { updateOne: async (...args) => { calls.push(args); return { modifiedCount: 1 } }, bulkWrite: async () => ({}) },
    { findById: () => ({ lean: async () => ({ username: "shop", usernames: [] }) }) }
  )
  await importer.importAffiliate(affiliateFile([affiliateRow(), affiliateRow({ "Tên người dùng nhà sáng tạo": "creator-2" })]), channelId)
  assert.equal(calls.length, 2)
  for (const [, , options] of calls) {
    assert.equal(options.arrayFilters[0]["product.sourceChecked"], false)
  }
})
