import { BadRequestException, Injectable, Optional } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import * as XLSX from "xlsx"
import { Model, Types } from "mongoose"
import { inputBusinessDay } from "../common/input-validation"
import { DailyAdsMetrics, DailyAdsMetricsDocument } from "../ads/daily-ads-metrics.schema"
import { calculateAdsMetrics } from "../ads/ads-metrics"
import { Channel, ChannelDocument } from "../channels/channel.schema"
import { Income, IncomeDocument } from "./income.schema"

const header = (value: unknown) => String(value ?? "").replace(/^\uFEFF/, "").trim()

const valueAt = (row: Record<string, unknown>, ...headers: string[]) =>
  headers.map((key) => row[header(key)]).find((value) => value !== undefined && value !== null && String(value).trim() !== "")

const text = (value: unknown) => String(value ?? "").trim()

const parsedNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  const raw = text(value).replace(/[%₫đ\s]/gi, "")
  if (!raw) return undefined
  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
    : raw.includes(",")
      ? /,\d{3}$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".")
      : raw.includes(".")
        ? /\.\d{3}$/.test(raw) ? raw.replace(/\./g, "") : raw
      : raw
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : undefined
}

const number = (value: unknown) => parsedNumber(value) ?? 0

const numberAt = (row: Record<string, unknown>, key?: string) =>
  key ? number(row[header(key)]) : 0

// Excel X and AA are zero-based indexes 23 and 26.
const affiliateCostColumnIndexes = [23, 26] as const

const requiredNumber = (value: unknown, field: string, positive = false) => {
  const result = parsedNumber(value)
  if (result === undefined || result < 0 || (positive && result <= 0)) {
    throw new BadRequestException(`${field} không hợp lệ`)
  }
  return result
}

const hasValue = (value: unknown) => value !== undefined && value !== null && text(value) !== ""

const normalized = (value: unknown) => text(value)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")

const isCancelledValue = (value: unknown) =>
  new Set(["cancel", "cancelled", "canceled", "huy", "da huy"]).has(normalized(value))

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
    @InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>,
    @Optional() @InjectModel(DailyAdsMetrics.name) private readonly metrics?: Model<DailyAdsMetricsDocument>
  ) {}

  private rows(file: Express.Multer.File) {
    // Keep Excel dates as serial numbers, then convert them explicitly to Vietnam time.
    // Letting SheetJS construct Date values here would depend on Render's timezone.
    const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: false })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!worksheet) throw new BadRequestException("File Excel không có sheet dữ liệu")
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" })
      .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [header(key), value])))
    const [rawHeaders = []] = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" })
    const headerRow = rawHeaders.map(header)
    return { rows, headers: new Set(headerRow.filter(Boolean)), headerRow }
  }

  private requireHeaders(headers: Set<string>, required: string[][], type: string) {
    const missing = required.filter((alternatives) => !alternatives.some((item) => headers.has(header(item))))
    if (missing.length) {
      throw new BadRequestException(`File ${type} thiếu cột: ${missing.map((items) => items[0]).join(", ")}`)
    }
  }

  private totalRows(file: Express.Multer.File) {
    const sheet = this.rows(file)
    this.requireHeaders(sheet.headers, [
      ["Order ID"], ["Created Time", "Order Created Time", "Order Creation Time"], ["Seller SKU"],
      ["Quantity"], ["SKU Subtotal Before Discount"], ["SKU Subtotal After Discount"]
    ], "tổng doanh thu")
    if (!sheet.rows.length) throw new BadRequestException("File tổng doanh thu không có dòng dữ liệu")
    return sheet.rows
  }

  private affiliateRows(file: Express.Multer.File) {
    const sheet = this.rows(file)
    this.requireHeaders(sheet.headers, [["ID đơn hàng", "Order ID"], ["Sku người bán", "SKU người bán", "Seller SKU"], ["Số lượng", "Quantity"]], "affiliate")
    if (!sheet.rows.length) throw new BadRequestException("File affiliate không có dòng dữ liệu")
    return {
      rows: sheet.rows,
      costColumns: [
        sheet.headerRow[affiliateCostColumnIndexes[0]],
        sheet.headerRow[affiliateCostColumnIndexes[1]]
      ] as [string | undefined, string | undefined]
    }
  }

  private statusRows(file: Express.Multer.File) {
    const sheet = this.rows(file)
    this.requireHeaders(sheet.headers, [["Order ID"], ["Order Status"], ["Cancelation/Return Type", "Cancellation/Return Type"]], "cập nhật trạng thái")
    if (!sheet.rows.length) throw new BadRequestException("File cập nhật trạng thái không có dòng dữ liệu")
    return sheet.rows
  }

  async importTotal(file: Express.Multer.File, channelId: string) {
    const rows = this.totalRows(file)
    const groups = new Map<string, { row: Record<string, unknown>; createdAt: Date }[]>()

    for (const row of rows) {
      const createdAt = date(valueAt(row, "Created Time"))
      if (!createdAt) continue

      const orderId = text(valueAt(row, "Order ID"))
      if (!orderId) continue
      const cancellation = text(valueAt(row, "Cancelation/Return Type", "Cancellation/Return Type"))
      if (cancellation.toLowerCase() === "cancel") continue
      groups.set(orderId, [...(groups.get(orderId) ?? []), { row, createdAt }])
    }

    const operations = [...groups].map(([orderId, lines]) => {
      const first = lines[0].row
      const income = {
        orderId,
        customer: text(valueAt(first, "Buyer Username")),
        province: text(valueAt(first, "Province")),
        shippingProvider: text(valueAt(first, "Shipping Provider Name")),
        orderStatus: text(valueAt(first, "Order Status")),
        cancelationOrReturnType: text(valueAt(first, "Cancelation/Return Type", "Cancellation/Return Type")),
        channel: new Types.ObjectId(channelId),
        date: lines[0].createdAt,
        products: lines.map(({ row: line }) => ({
          code: text(valueAt(line, "Seller SKU")),
          name: text(valueAt(line, "Product Name")),
          source: "other",
          sourceChecked: false,
          affiliateAdsPercentage: 0,
          affiliateAdsAmount: 0,
          standardAffPercentage: 0,
          standardAffAmount: 0,
          quantity: requiredNumber(valueAt(line, "Quantity"), "Quantity", true),
          price: requiredNumber(valueAt(line, "SKU Subtotal Before Discount"), "SKU Subtotal Before Discount"),
          priceAfterDiscount: requiredNumber(valueAt(line, "SKU Subtotal After Discount"), "SKU Subtotal After Discount")
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
    const { rows, costColumns } = this.affiliateRows(file)
    const channel = await this.channels.findById(channelId).lean()
    const aliases = new Set(
      [channel?.username, ...(channel?.usernames ?? [])]
        .map((item) => text(item).toLowerCase())
        .filter(Boolean)
    )
    let updated = 0
    const affectedDates = new Set<number>()

    for (const row of rows) {
      const orderId = text(valueAt(row, "ID đơn hàng", "Order ID"))
      const code = text(valueAt(row, "Sku người bán", "SKU người bán", "Seller SKU"))
      const quantity = number(valueAt(row, "Số lượng", "Quantity"))
      if (!orderId || !code || quantity <= 0) continue

      const existingIncome = typeof (this.incomes as any).findOne === "function"
        ? await this.incomes.findOne({ orderId, channel: new Types.ObjectId(channelId) }).lean()
        : undefined
      if (this.isCancelled(row, existingIncome)) continue
      if (existingIncome?.date) affectedDates.add(inputBusinessDay(existingIncome.date).valueOf())

      const creator = text(valueAt(row, "Tên người dùng nhà sáng tạo", "Creator Username"))
      const adsRaw = valueAt(row, "Tỷ lệ hoa hồng Quảng cáo cửa hàng", "Tỷ lệ hoa hồng quảng cáo cửa hàng")
      const standardRaw = valueAt(row, "Tỷ lệ hoa hồng tiêu chuẩn")
      const affiliateAdsAmountValue = valueAt(row, "Hoa hồng Quảng cáo cửa hàng", "Số tiền hoa hồng Quảng cáo cửa hàng")
      const standardAffAmountValue = valueAt(row, "Hoa hồng tiêu chuẩn", "Số tiền hoa hồng tiêu chuẩn")
      const affiliateAdsAmount = number(affiliateAdsAmountValue)
      const standardAffAmount = number(standardAffAmountValue)
      const costColumnValues = costColumns.map((column) => numberAt(row, column))
      const hasPositionalCostColumns = costColumns.some(Boolean)
      const storedAffiliateAdsAmount = hasPositionalCostColumns
        ? costColumnValues[0]
        : hasValue(affiliateAdsAmountValue)
        ? affiliateAdsAmount
        : costColumnValues[0]
      const storedStandardAffAmount = hasPositionalCostColumns
        ? costColumnValues[1]
        : hasValue(standardAffAmountValue)
        ? standardAffAmount
        : costColumnValues[1]
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
          products: { $elemMatch: { code, quantity, sourceChecked: false } }
        },
        {
          $set: {
            "products.$[product].sourceChecked": true,
            "products.$[product].creator": creator,
            "products.$[product].content": text(valueAt(row, "Loại nội dung", "Content Type")),
            "products.$[product].source": source,
            "products.$[product].affiliateAdsPercentage": ads,
            "products.$[product].affiliateAdsAmount": storedAffiliateAdsAmount,
            "products.$[product].standardAffPercentage": standard,
            "products.$[product].standardAffAmount": storedStandardAffAmount
          }
        },
        { arrayFilters: [{ "product.code": code, "product.quantity": quantity, "product.sourceChecked": false }] }
      )
      updated += result.modifiedCount
    }
    await this.updateAffiliateMetrics(channelId, affectedDates)
    return { updated }
  }

  private isCancelled(row: Record<string, unknown>, income?: Partial<Income> | null) {
    return [
      valueAt(row, "Order Status", "Trạng thái đơn hàng", "Trạng thái đơn"),
      valueAt(row, "Cancelation/Return Type", "Cancellation/Return Type"),
      income?.orderStatus,
      income?.cancelationOrReturnType
    ].some(isCancelledValue)
  }

  private async updateAffiliateMetrics(channelId: string, affectedDates: Set<number>) {
    if (!this.metrics || affectedDates.size === 0) return

    const channel = new Types.ObjectId(channelId)
    for (const timestamp of affectedDates) {
      const date = new Date(timestamp)
      const nextDate = new Date(timestamp + 86_400_000)
      const incomes = await this.incomes
        .find({ channel, date: { $gte: date, $lt: nextDate } })
        .lean()
      const affiliateCost = incomes
        .filter((income) => !this.isCancelled({}, income))
        .reduce((sum, income) => sum + income.products.reduce(
          (productSum, product) => productSum + number(product.affiliateAdsAmount) + number(product.standardAffAmount),
          0
        ), 0)
      const existing = await this.metrics.findOne({ channel, date }).lean()
      const calculated = calculateAdsMetrics({
        roiProtect: Number(existing?.roiProtect ?? 0),
        tinRefundAmount: Number(existing?.tinRefundAmount ?? 0),
        gmvAds: Number(existing?.gmvAds ?? 0),
        adsManual: Number(existing?.adsManual ?? 0),
        affiliateCost,
        totalRevenue: Number(existing?.totalRevenue ?? 0),
        refundCancelRate: Number(existing?.refundCancelRate ?? 0)
      })
      await this.metrics.findOneAndUpdate(
        { channel, date },
        {
          $set: {
            channel,
            date,
            roiProtect: Number(existing?.roiProtect ?? 0),
            tinRefundAmount: Number(existing?.tinRefundAmount ?? 0),
            gmvAds: Number(existing?.gmvAds ?? 0),
            adsManual: Number(existing?.adsManual ?? 0),
            ...calculated
          }
        },
        { upsert: true, new: true }
      )
    }
  }

  async updateStatuses(file: Express.Multer.File, channelId: string) {
    const operations = this.statusRows(file)
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
