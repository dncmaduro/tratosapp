const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const XLSX = require("xlsx")
const { IncomeImportService } = require("../dist/incomes/income-import.service")

const channelId = "507f1f77bcf86cd799439011"

function affiliateFile(rows) {
  const headers = Array.from({ length: 27 }, (_, index) => `Column ${index + 1}`)
  headers[0] = "ID đơn hàng"
  headers[1] = "Sku người bán"
  headers[2] = "Số lượng"
  headers[3] = "Order Status"
  headers[23] = "X affiliate cost"
  headers[26] = "AA affiliate cost"
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, ...rows]), "Affiliate")
  return { buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) }
}

function row(orderId, status, xCost, aaCost) {
  const values = Array(27).fill("")
  values[0] = orderId
  values[1] = "SKU-1"
  values[2] = 2
  values[3] = status
  values[23] = xCost
  values[26] = aaCost
  return values
}

test("affiliate import sums columns X and AA, skips cancelled orders, and upserts daily ads metrics", async () => {
  const documents = [
    {
      orderId: "ORDER-1",
      date: new Date("2026-09-26T03:00:00.000Z"),
      orderStatus: "Delivered",
      cancelationOrReturnType: "",
      products: [{ code: "SKU-1", quantity: 2, affiliateAdsAmount: 0, standardAffAmount: 0 }]
    },
    {
      orderId: "ORDER-CANCELLED",
      date: new Date("2026-09-26T04:00:00.000Z"),
      orderStatus: "Canceled",
      cancelationOrReturnType: "",
      products: [{ code: "SKU-1", quantity: 2, affiliateAdsAmount: 0, standardAffAmount: 0 }]
    }
  ]
  const incomeUpdates = []
  const metricUpdates = []
  const incomes = {
    findOne: filter => ({
      lean: async () => documents.find(document => document.orderId === filter.orderId) ?? null
    }),
    updateOne: async (filter, update) => {
      incomeUpdates.push({ filter, update })
      const document = documents.find(item => item.orderId === filter.orderId)
      if (document) {
        document.products[0].affiliateAdsAmount = update.$set["products.$[product].affiliateAdsAmount"]
        document.products[0].standardAffAmount = update.$set["products.$[product].standardAffAmount"]
      }
      return { modifiedCount: document?.orderStatus === "Delivered" ? 1 : 0 }
    },
    find: () => ({ lean: async () => documents })
  }
  const metrics = {
    findOne: () => ({ lean: async () => ({
      roiProtect: 100,
      tinRefundAmount: 50,
      gmvAds: 1000,
      totalRevenue: 2000,
      refundCancelRate: 10,
      affiliateCost: 999
    }) }),
    findOneAndUpdate: async (...args) => {
      metricUpdates.push(args)
      return { _id: "metric" }
    }
  }
  const importer = new IncomeImportService(
    incomes,
    { findById: () => ({ lean: async () => ({ username: "shop", usernames: [] }) }) },
    metrics
  )

  const result = await importer.importAffiliate(
    affiliateFile([
      row("ORDER-1", "Delivered", 100, 50),
      row("ORDER-CANCELLED", "Canceled", 700, 800)
    ]),
    channelId
  )

  assert.deepEqual(result, { updated: 1 })
  assert.equal(incomeUpdates.length, 1)
  assert.equal(metricUpdates.length, 1)
  const [filter, update] = metricUpdates[0]
  assert.equal(filter.date.toISOString(), "2026-09-25T17:00:00.000Z")
  assert.equal(update.$set.affiliateCost, 150)
  assert.equal(update.$set.actualAdsCost, 850)
  assert.equal(update.$set.totalCost, 1000)
})
