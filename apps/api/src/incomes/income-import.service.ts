import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import * as XLSX from "xlsx"
import { Model, Types } from "mongoose"
import { Income, IncomeDocument } from "./income.schema"

@Injectable()
export class IncomeImportService {
  constructor(@InjectModel(Income.name) private readonly incomes: Model<IncomeDocument>) {}
  async importTotal(file: Express.Multer.File, channelId: string) {
    const sheet = XLSX.read(file.buffer, { type: "buffer" }).Sheets[XLSX.read(file.buffer, { type: "buffer" }).SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    const groups = new Map<string, Record<string, unknown>[]>()
    for (const row of rows) { const id = String(row["Order ID"] ?? "").trim(); if (id && String(row["Cancelation/Return Type"] ?? "") !== "Cancel") groups.set(id, [...(groups.get(id) ?? []), row]) }
    const docs = [...groups].map(([orderId, lines]) => { const first = lines[0]; const date = new Date(String(first["Created Time"] ?? "")); if (Number.isNaN(date.valueOf())) throw new BadRequestException("File tổng doanh thu thiếu cột Created Time hợp lệ"); return { orderId, customer: String(first["Buyer Username"] ?? ""), province: String(first["Province"] ?? ""), shippingProvider: String(first["Shipping Provider Name"] ?? ""), orderStatus: String(first["Order Status"] ?? ""), cancelationOrReturnType: String(first["Cancelation/Return Type"] ?? ""), channel: new Types.ObjectId(channelId), date, products: lines.map((line) => ({ code: String(line["Seller SKU"] ?? ""), name: String(line["Product Name"] ?? ""), source: "other", quantity: Number(line["Quantity"]) || 0, price: Number(line["SKU Subtotal Before Discount"]) || 0, priceAfterDiscount: Number(line["SKU Subtotal After Discount"]) || 0 })) } })
    if (docs.length) await this.incomes.insertMany(docs, { ordered: false })
    return { importedOrders: docs.length }
  }
  async importAffiliate(file: Express.Multer.File, channelId: string, channelUsername = "") {
    const workbook = XLSX.read(file.buffer, { type: "buffer" }); const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
    let updated = 0
    for (const row of rows) { const orderId = String(row["ID đơn hàng"] ?? "").trim(); const code = String(row["Sku người bán"] ?? "").trim(); const quantity = Number(row["Số lượng"]); if (!orderId || !code || !Number.isFinite(quantity)) continue; const creator = String(row["Tên người dùng nhà sáng tạo"] ?? ""); const ads = Number(row["Tỷ lệ hoa hồng Quảng cáo cửa hàng"]); const standard = Number(row["Tỷ lệ hoa hồng tiêu chuẩn"]); const source = creator.toLowerCase() === channelUsername.toLowerCase() ? "ads" : Number.isFinite(ads) && !Number.isFinite(standard) ? "affiliate-ads" : Number.isFinite(standard) ? "affiliate" : "other"; const result = await this.incomes.updateOne({ orderId, channel: new Types.ObjectId(channelId), products: { $elemMatch: { code, quantity } } }, { $set: { "products.$.sourceChecked": true, "products.$.creator": creator, "products.$.content": String(row["Loại nội dung"] ?? ""), "products.$.source": source, "products.$.affiliateAdsPercentage": Number.isFinite(ads) ? ads : 0, "products.$.standardAffPercentage": Number.isFinite(standard) ? standard : 0 } }); updated += result.modifiedCount }
    return { updated }
  }
  async updateStatuses(file: Express.Multer.File, channelId: string) {
    const workbook = XLSX.read(file.buffer, { type: "buffer" }); const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]])
    const operations = rows.map((row) => ({ updateOne: { filter: { orderId: String(row["Order ID"] ?? "").trim(), channel: new Types.ObjectId(channelId) }, update: { $set: { orderStatus: String(row["Order Status"] ?? ""), cancelationOrReturnType: String(row["Cancelation/Return Type"] ?? "") } } } })).filter((op) => Boolean(op.updateOne.filter.orderId))
    if (!operations.length) return { updated: 0 }; const result = await this.incomes.bulkWrite(operations, { ordered: false }); return { updated: result.modifiedCount }
  }
}
