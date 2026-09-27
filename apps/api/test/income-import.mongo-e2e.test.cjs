const assert = require("node:assert/strict")
const { test } = require("node:test")
require("reflect-metadata")
const { NestFactory } = require("@nestjs/core")
const { getConnectionToken, getModelToken } = require("@nestjs/mongoose")
const { JwtService } = require("@nestjs/jwt")
const XLSX = require("xlsx")
const { User } = require("../dist/users/user.schema")
const { Channel } = require("../dist/channels/channel.schema")
const { Income } = require("../dist/incomes/income.schema")

const mongoUri = process.env.TRATOSAPP_E2E_MONGODB_URI

function excelFile(rows, sheetName) {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
}

test("HTTP full income import persists revenue and affiliate data in isolated MongoDB", {
  skip: !mongoUri && "Set TRATOSAPP_E2E_MONGODB_URI to a dedicated test MongoDB URI to run this integration test"
}, async () => {
  const parsedUri = new URL(mongoUri)
  const baseDatabase = decodeURIComponent(parsedUri.pathname.replace(/^\//, ""))
  assert.match(baseDatabase, /(?:test|e2e)/i, "MongoDB database name must contain 'test' or 'e2e'")

  const originalDatabaseUrl = process.env.DATABASE_URL
  const originalJwtSecret = process.env.JWT_SECRET
  const runDatabase = `${baseDatabase.replace(/[^a-z\d_-]/gi, "-")}-${process.pid}-${Date.now()}`
  parsedUri.pathname = `/${runDatabase}`
  process.env.DATABASE_URL = parsedUri.toString()
  process.env.JWT_SECRET = "tratosapp-mongo-e2e-only-secret"

  let app
  try {
    const { AppModule } = require("../dist/app.module")
    app = await NestFactory.create(AppModule, { logger: false })
    app.setGlobalPrefix("api/v1")
    await app.listen(0, "127.0.0.1")

    const users = app.get(getModelToken(User.name))
    const channels = app.get(getModelToken(Channel.name))
    const incomes = app.get(getModelToken(Income.name))
    const user = await users.create({
      email: `mongo-e2e-${process.pid}@tratosapp.invalid`,
      passwordHash: "unused-in-test",
      name: "Mongo E2E",
      permissions: ["api.incomes.insert-and-update-affiliate-type"],
      active: true
    })
    const channel = await channels.create({ name: "E2E Shop", username: "shop-account", usernames: [] })
    const token = await app.get(JwtService).signAsync({ sub: user.id, type: "access" }, { expiresIn: "5m" })

    const total = excelFile([{
      "Order ID": "E2E-ORDER-1",
      "Created Time": "2026-09-26 10:30:00",
      "Seller SKU": "E2E-SKU-1",
      "Product Name": "E2E product",
      "Quantity": 2,
      "SKU Subtotal Before Discount": 100000,
      "SKU Subtotal After Discount": 90000,
      "Buyer Username": "e2e-buyer",
      "Order Status": "Delivered",
      "Cancelation/Return Type": ""
    }], "Orders")
    const affiliate = excelFile([{
      "ID đơn hàng": "E2E-ORDER-1",
      "Sku người bán": "E2E-SKU-1",
      "Số lượng": 2,
      "Tên người dùng nhà sáng tạo": "creator-account",
      "Loại nội dung": "Video",
      "Tỷ lệ hoa hồng tiêu chuẩn": 10,
      "Hoa hồng tiêu chuẩn": 20000
    }], "Affiliate")

    const address = app.getHttpServer().address()
    const form = new FormData()
    form.set("channel", channel.id)
    form.set("updateMode", "full")
    form.append("files", new Blob([total]), "orders.xlsx")
    form.append("files", new Blob([affiliate]), "affiliate.xlsx")
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/incomes/insert-and-update-source`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    })
    const payload = await response.json()
    assert.equal(response.status, 201)
    assert.deepEqual(payload, {
      success: true,
      message: "Đã import doanh thu",
      importedOrders: 1,
      updatedOrders: 0,
      affiliateUpdated: 1
    })

    const documents = await incomes.find({}).lean()
    const income = documents.find((document) => document.orderId === "E2E-ORDER-1")
    assert.ok(income, `Expected imported order in isolated database; found ${JSON.stringify(documents)}`)
    assert.equal(income.channel.toString(), channel.id)
    assert.equal(income.customer, "e2e-buyer")
    assert.equal(income.products[0].source, "affiliate")
    assert.equal(income.products[0].sourceChecked, true)
    assert.equal(income.products[0].standardAffPercentage, 10)
    assert.equal(income.products[0].standardAffAmount, 20000)
  } finally {
    if (app) {
      const connection = app.get(getConnectionToken())
      await connection.dropDatabase().catch(() => {})
      await app.close()
    }
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
  }
})
