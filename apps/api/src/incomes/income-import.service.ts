import { BadRequestException, Injectable } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import * as XLSX from "xlsx"
import { Model, Types } from "mongoose"
import { Channel, ChannelDocument } from "../channels/channel.schema"
import { Income, IncomeDocument } from "./income.schema"

const valueAt = (row: Record<string, unknown>, ...headers: string[]) =>
  headers.map((header) => row[header]).find((value) => value !== undefined && value !== null && String(value).trim() !== "")

const text = (value: unknown) => String(value ?? "").trim()

const number = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  const raw = text(value).replace(/[%₫đ\s]/gi, "")
  if (!raw) return 0
  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
    : raw.includes(",")
      ? raw.replace(",", ".")
      : raw
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const hasValue = (value: unknown) => value !== undefined && value !== null && text(value) !== ""

const vietnamDate = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0
) => {
  const validated = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))
  if (validated.getUTCFullYear() !== year || validated.getUTCMonth() !== month - 1 ||
      validated.getUTCDate() !== day || validated.getUTCHours() !== hour ||
      validated.getUTCMinutes() !== minute || validated.getUTCSeconds() !== second ||
      validated.getUTCMilliseconds() !== millisecond) return undefined
  // Vietnam has no daylight-saving changes, so UTC+07:00 is stable.
  return new Date(validated.valueOf() - 7 * 60 * 60 * 1000)
}

const date = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return vietnamDate(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, parsed.S)
  }
  const raw = text(value)
  const vietnamDayFirst = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/)
  if (vietnamDayFirst) {
    const [, day, month, year, hour = "0", minute = "0", second = "0", milliseconds = "0"] = vietnamDayFirst
    return vietnamDate(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second), Number(milliseconds.padEnd(3, "0")))
  }
  const vietnamYearFirst = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/)
  if (vietnamYearFirst) {
    const [, year, month, day, hour = "0", minute = "0", second = "0", milliseconds = "0"] = vietnamYearFirst
    return vietnamDate(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second), Number(milliseconds.padEnd(3, "0")))
  }
  const parsed = new Date(raw)
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed
}

@Injectable()
export class IncomeImportService {
  constructor(
    @InjectModel(Income.name) private readonly incomes: Model<IncomeDocument>,
    @InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>
  ) {}

  private rows(file: Express.Multer.File) {
    // Keep Excel dates as serial numbers, then convert them explicitly to Vietnam time.
    // Letting SheetJS construct Date values here would depend on Render's timezone.
    const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!worksheet) throw new BadRequestException("File Excel không có sheet dữ liệu")
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
  }

  async importTotal(file: Express.Multer.File, channelId: string) {
    const rows = this.rows(file)
    const groups = new Map<string, Record<string, unknown>[]>()

    for (const row of rows) {
      const orderId = text(valueAt(row, "Order ID"))
      if (!orderId) continue
      const cancellation = text(valueAt(row, "Cancelation/Return Type", "Cancellation/Return Type"))
      if (cancellation.toLowerCase() === "cancel") continue
      groups.set(orderId, [...(groups.get(orderId) ?? []), row])
    }

    const operations = [...groups].map(([orderId, lines]) => {
      const first = lines[0]
      const createdAt = date(valueAt(first, "Created Time"))
      if (!createdAt) {
        throw new BadRequestException("File tổng doanh thu thiếu cột Created Time hợp lệ")
      }
      const income = {
        orderId,
        customer: text(valueAt(first, "Buyer Username")),
        province: text(valueAt(first, "Province")),
        shippingProvider: text(valueAt(first, "Shipping Provider Name")),
        orderStatus: text(valueAt(first, "Order Status")),
        cancelationOrReturnType: text(valueAt(first, "Cancelation/Return Type", "Cancellation/Return Type")),
        channel: new Types.ObjectId(channelId),
        date: createdAt,
        products: lines.map((line) => ({
          code: text(valueAt(line, "Seller SKU")),
          name: text(valueAt(line, "Product Name")),
          source: "other",
          sourceChecked: false,
          affiliateAdsPercentage: 0,
          affiliateAdsAmount: 0,
          standardAffPercentage: 0,
          standardAffAmount: 0,
          quantity: number(valueAt(line, "Quantity")),
          price: number(valueAt(line, "SKU Subtotal Before Discount")),
          priceAfterDiscount: number(valueAt(line, "SKU Subtotal After Discount"))
        }))
      }
      return {
        updateOne: {
          filter: { orderId, channel: new Types.ObjectId(channelId) },
          update: { $set: income },
          upsert: true
        }
      }
    })

    if (!operations.length) return { importedOrders: 0, updatedOrders: 0 }
    const result = await this.incomes.bulkWrite(operations, { ordered: false })
    return {
      importedOrders: result.upsertedCount,
      updatedOrders: result.modifiedCount
    }
  }

  async importAffiliate(file: Express.Multer.File, channelId: string) {
    const rows = this.rows(file)
    const channel = await this.channels.findById(channelId).lean()
    const aliases = new Set(
      [channel?.username, ...(channel?.usernames ?? [])]
        .map((item) => text(item).toLowerCase())
        .filter(Boolean)
    )
    let updated = 0

    for (const row of rows) {
      const orderId = text(valueAt(row, "ID đơn hàng", "Order ID"))
      const code = text(valueAt(row, "Sku người bán", "SKU người bán", "Seller SKU"))
      const quantity = number(valueAt(row, "Số lượng", "Quantity"))
      if (!orderId || !code || quantity <= 0) continue

      const creator = text(valueAt(row, "Tên người dùng nhà sáng tạo", "Creator Username"))
      const adsRaw = valueAt(row, "Tỷ lệ hoa hồng Quảng cáo cửa hàng", "Tỷ lệ hoa hồng quảng cáo cửa hàng")
      const standardRaw = valueAt(row, "Tỷ lệ hoa hồng tiêu chuẩn")
      const affiliateAdsAmount = number(valueAt(row, "Hoa hồng Quảng cáo cửa hàng", "Số tiền hoa hồng Quảng cáo cửa hàng"))
      const standardAffAmount = number(valueAt(row, "Hoa hồng tiêu chuẩn", "Số tiền hoa hồng tiêu chuẩn"))
      const ads = number(adsRaw)
      const standard = number(standardRaw)
      const source = aliases.has(creator.toLowerCase())
        ? "ads"
        : hasValue(adsRaw) && !hasValue(standardRaw)
          ? "affiliate-ads"
          : hasValue(standardRaw)
            ? "affiliate"
            : "other"

      const result = await this.incomes.updateOne(
        {
          orderId,
          channel: new Types.ObjectId(channelId),
          products: { $elemMatch: { code, quantity } }
        },
        {
          $set: {
            "products.$.sourceChecked": true,
            "products.$.creator": creator,
            "products.$.content": text(valueAt(row, "Loại nội dung", "Content Type")),
            "products.$.source": source,
            "products.$.affiliateAdsPercentage": ads,
            "products.$.affiliateAdsAmount": affiliateAdsAmount,
            "products.$.standardAffPercentage": standard,
            "products.$.standardAffAmount": standardAffAmount
          }
        }
      )
      updated += result.modifiedCount
    }
    return { updated }
  }

  async updateStatuses(file: Express.Multer.File, channelId: string) {
    const operations = this.rows(file)
      .map((row) => {
        const orderId = text(valueAt(row, "Order ID"))
        if (!orderId) return undefined
        return {
          updateOne: {
            filter: { orderId, channel: new Types.ObjectId(channelId) },
            update: {
              $set: {
                orderStatus: text(valueAt(row, "Order Status")),
                cancelationOrReturnType: text(valueAt(row, "Cancelation/Return Type", "Cancellation/Return Type"))
              }
            }
          }
        }
      })
      .filter((operation): operation is NonNullable<typeof operation> => Boolean(operation))
    if (!operations.length) return { updated: 0 }
    const result = await this.incomes.bulkWrite(operations, { ordered: false })
    return { updated: result.modifiedCount }
  }
}
