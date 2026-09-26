const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const XLSX = require("xlsx")
const { IncomesController } = require("../dist/incomes/incomes.controller")
const { IncomeImportService } = require("../dist/incomes/income-import.service")

const channelId = "507f1f77bcf86cd799439011"
const controller = () => new IncomesController({}, {}, {}, {}, {})

test("TikTok SKU subtotal is counted once even when its quantity is greater than one", () => {
  const sut = controller()
  const products = [
    { source: "live", quantity: 3, price: 300_000, priceAfterDiscount: 270_000 },
    { source: "affiliate", quantity: 2, price: 200_000, priceAfterDiscount: 180_000 }
  ]
  assert.deepEqual(sut.splitRevenue(products, false), {
    totalIncome: 500_000, liveIncome: 300_000, videoIncome: 0, ownVideoIncome: 0,
    otherVideoIncome: 0, otherIncome: 200_000,
    sources: { ads: 0, affiliate: 200_000, affiliateAds: 0, other: 300_000 }
  })
  assert.deepEqual(sut.splitRevenue(products, true).sources, {
    ads: 0, affiliate: 180_000, affiliateAds: 0, other: 270_000
  })
  assert.deepEqual(sut.monthSplit(products, false), { live: 300_000, shop: 200_000 })
  assert.deepEqual(sut.monthSplit(products, true), { live: 270_000, shop: 180_000 })
})

test("the imported TikTok SKU Subtotal feeds the revenue calculation without a second quantity multiplier", async () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet([{
    "Order ID": "ORDER-1", "Created Time": "2026-09-26T10:00:00+07:00", "Buyer Username": "buyer",
    "Seller SKU": "SKU-1", "Product Name": "Product", Quantity: 3,
    "SKU Subtotal Before Discount": 300_000, "SKU Subtotal After Discount": 270_000
  }])
  XLSX.utils.book_append_sheet(workbook, sheet, "Orders")
  const operations = []
  const importer = new IncomeImportService(
    { bulkWrite: async items => { operations.push(...items); return { upsertedCount: 1, modifiedCount: 0 } }, updateOne: async () => ({ modifiedCount: 0 }) },
    { findById: () => ({ lean: async () => null }) }
  )
  await importer.importTotal({ buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) }, channelId)
  const product = operations[0].updateOne.update.$set.products[0]
  assert.equal(product.quantity, 3)
  assert.equal(product.price, 300_000)
  assert.equal(controller().splitRevenue([product], false).totalIncome, 300_000)
  assert.equal(controller().splitRevenue([product], true).totalIncome, 270_000)
})
