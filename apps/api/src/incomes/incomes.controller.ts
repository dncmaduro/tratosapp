import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors
} from "@nestjs/common"
import { FilesInterceptor } from "@nestjs/platform-express"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import * as XLSX from "xlsx"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { DailyAdsMetrics, DailyAdsMetricsDocument } from "../ads/daily-ads-metrics.schema"
import { MonthGoal, MonthGoalDocument } from "../month-goals/month-goal.schema"
import { Income, IncomeDocument } from "./income.schema"
import { IncomeImportService } from "./income-import.service"
import { Channel, ChannelDocument } from "../channels/channel.schema"
import { inputId, inputString } from "../common/input-validation"

const importModes = ["full", "status-only", "base-only", "affiliate-only"] as const
type ImportMode = (typeof importModes)[number]

function importInput(
  files: Express.Multer.File[] | undefined,
  channel: unknown,
  updateMode: unknown,
  chunkIndex: unknown,
  chunkCount: unknown
) {
  const mode = updateMode === undefined ? "full" : inputString(updateMode, "updateMode")
  if (!importModes.includes(mode as ImportMode)) throw new BadRequestException("updateMode không hợp lệ")
  const expectedFiles = mode === "full" ? 2 : 1
  if (!files || files.length !== expectedFiles) {
    throw new BadRequestException(`Chế độ ${mode} cần đúng ${expectedFiles} file`)
  }
  for (const file of files) {
    if (!file?.buffer?.length || !/\.(xlsx|xls|csv)$/i.test(file.originalname ?? "")) {
      throw new BadRequestException("Chỉ hỗ trợ file .xlsx, .xls hoặc .csv có dữ liệu")
    }
  }
  const hasChunk = chunkIndex !== undefined || chunkCount !== undefined
  if (hasChunk) {
    const index = Number(chunkIndex)
    const count = Number(chunkCount)
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || count < 1 || index >= count) {
      throw new BadRequestException("Thông tin thứ tự chunk không hợp lệ")
    }
  }
  return { channel: inputId(channel), mode: mode as ImportMode }
}

type RevenueSplit = {
  totalIncome: number
  liveIncome: number
  videoIncome: number
  ownVideoIncome: number
  otherVideoIncome: number
  otherIncome: number
  sources: { ads: number; affiliate: number; affiliateAds: number; other: number }
}

@ApiTags("incomes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("incomes")
export class IncomesController {
  constructor(
    @InjectModel(Income.name) private readonly incomes: Model<IncomeDocument>,
    @InjectModel(DailyAdsMetrics.name)
    private readonly metrics: Model<DailyAdsMetricsDocument>,
    @InjectModel(MonthGoal.name) private readonly goals: Model<MonthGoalDocument>,
    @InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>,
    private readonly importer: IncomeImportService
  ) {}

  private channel(channelId: string) {
    return new Types.ObjectId(channelId)
  }

  private dates(startDate: string, endDate: string) {
    return { $gte: new Date(startDate), $lte: new Date(endDate) }
  }

  private isLive(source?: string) {
    return ["live", "livestream"].includes((source ?? "").toLowerCase())
  }

  private splitRevenue(
    products: Income["products"],
    afterDiscount: boolean
  ): RevenueSplit {
    const result: RevenueSplit = {
      totalIncome: 0,
      liveIncome: 0,
      videoIncome: 0,
      ownVideoIncome: 0,
      otherVideoIncome: 0,
      otherIncome: 0,
      sources: { ads: 0, affiliate: 0, affiliateAds: 0, other: 0 }
    }

    for (const product of products) {
      // TikTok Shop's SKU Subtotal columns already include Quantity.
      // Keep this aligned with the original Candy calculation: sum each line once.
      const revenue = afterDiscount ? product.priceAfterDiscount || product.price : product.price || 0
      const source = (product.source || "other").toLowerCase()
      result.totalIncome += revenue
      if (this.isLive(source)) result.liveIncome += revenue
      else result.otherIncome += revenue
      if (source === "ads") result.sources.ads += revenue
      else if (source === "affiliate") result.sources.affiliate += revenue
      else if (["affiliate-ads", "affiliate_ads"].includes(source)) result.sources.affiliateAds += revenue
      else result.sources.other += revenue
    }
    return result
  }

  private monthSplit(products: Income["products"], afterDiscount: boolean) {
    return products.reduce(
      (split, product) => {
        // See splitRevenue: this is a line subtotal, not a unit price.
        const revenue = afterDiscount
          ? product.priceAfterDiscount || product.price
          : product.price || 0
        if (this.isLive(product.source)) split.live += revenue
        else split.shop += revenue
        return split
      },
      { live: 0, shop: 0 }
    )
  }

  private async metricsSummary(
    channelId: string,
    date: { $gte: Date; $lte: Date },
    beforeDiscountIncome: number,
    afterDiscountIncome: number
  ) {
    const rows = await this.metrics
      .find({ channel: this.channel(channelId), date })
      .lean()
    const total = (field: keyof DailyAdsMetrics) =>
      rows.reduce((sum, row) => sum + Number(row[field] || 0), 0)
    const actualAdsCost = total("actualAdsCost")
    const totalCost = total("totalCost")
    const costAfterRefund = total("costAfterRefund")
    const ratio = (value: number) =>
      beforeDiscountIncome > 0 ? (value / beforeDiscountIncome) * 100 : 0

    return {
      totalAdsCost: actualAdsCost,
      liveAdsCost: 0,
      shopAdsCost: actualAdsCost,
      hasDailyAdsMetrics: rows.length > 0,
      adsSourceMode: "metrics" as const,
      metricsDaysCount: rows.length,
      actualAdsCost,
      totalCost,
      costAfterRefund,
      percentages: {
        liveAdsToLiveIncome: 0,
        shopAdsToShopIncome:
          afterDiscountIncome > 0 ? (actualAdsCost / afterDiscountIncome) * 100 : 0
      },
      ratios: {
        adsRatioOnBeforeDiscountRevenue: ratio(actualAdsCost),
        totalCostRatioOnBeforeDiscountRevenue: ratio(totalCost),
        costAfterRefundRatioOnBeforeDiscountRevenue: ratio(costAfterRefund),
        affiliateRatioOnBeforeDiscountRevenue: ratio(total("affiliateCost"))
      },
      rawMetrics: {
        roiProtect: total("roiProtect"),
        refundCancelRate: rows.length ? total("refundCancelRate") / rows.length : 0,
        fullRefundGmv: total("fullRefundGmv"),
        tinRefundAmount: total("tinRefundAmount"),
        adsTax: total("adsTax"),
        gmvAds: total("gmvAds"),
        affiliateCost: total("affiliateCost"),
        affiliateRefundAmount: total("affiliateRefundAmount"),
        totalRevenue: total("totalRevenue"),
        adjustedRevenue: total("adjustedRevenue"),
        incomeBeforeDiscount: beforeDiscountIncome,
        incomeAfterDiscount: afterDiscountIncome,
        recordsCount: rows.length,
        hasDailyAdsMetrics: rows.length > 0,
        adsSourceMode: "metrics" as const,
        metricsDaysCount: rows.length
      }
    }
  }

  @Get()
  async list(
    @Query("channelId") channelId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("orderId") orderId?: string,
    @Query("productSource") productSource?: string,
    @Query("page") page = "1",
    @Query("limit") limit = "10",
    @Query("searchText") searchText = ""
  ) {
    const filter: Record<string, unknown> = {}
    if (channelId) filter.channel = this.channel(channelId)
    if (orderId) filter.orderId = orderId
    if (productSource) filter["products.source"] = productSource
    if (startDate || endDate) {
      filter.date = {
        ...(startDate ? { $gte: new Date(startDate) } : {}),
        ...(endDate ? { $lte: new Date(endDate) } : {})
      }
    }
    if (searchText) {
      filter.$or = [
        { orderId: { $regex: searchText, $options: "i" } },
        { customer: { $regex: searchText, $options: "i" } }
      ]
    }
    const currentPage = Math.max(1, Number(page))
    const size = Math.min(10_000, Math.max(1, Number(limit)))
    const [incomes, total] = await Promise.all([
      this.incomes
        .find(filter)
        .sort({ date: -1 })
        .skip((currentPage - 1) * size)
        .limit(size)
        .populate("channel")
        .lean(),
      this.incomes.countDocuments(filter)
    ])
    return {
      incomes,
      total,
      page: currentPage,
      limit: size,
      totalPages: Math.ceil(total / size)
    }
  }

  @Post()
  @RequirePermissions("api.incomes.insert-and-update-affiliate-type")
  create(@Body() body: Partial<Income>) {
    return this.incomes.create(body)
  }

  @Get("income-split-by-month")
  async monthlyIncome(
    @Query("month") month: string,
    @Query("year") year: string,
    @Query("channelId") channelId: string
  ) {
    const start = new Date(Number(year), Number(month), 1)
    const end = new Date(Number(year), Number(month) + 1, 1)
    const docs = await this.incomes
      .find({ channel: this.channel(channelId), date: { $gte: start, $lt: end } })
      .lean()
    const products = docs.flatMap((income) => income.products)
    return {
      totalIncome: {
        beforeDiscount: this.monthSplit(products, false),
        afterDiscount: this.monthSplit(products, true)
      }
    }
  }

  @Get("quantity-split-by-month")
  async monthlyQuantity(
    @Query("month") month: string,
    @Query("year") year: string,
    @Query("channelId") channelId: string
  ) {
    const start = new Date(Number(year), Number(month), 1)
    const end = new Date(Number(year), Number(month) + 1, 1)
    const docs = await this.incomes
      .find({ channel: this.channel(channelId), date: { $gte: start, $lt: end } })
      .lean()
    const totalQuantity = docs
      .flatMap((income) => income.products)
      .reduce(
        (split, product) => {
          if (this.isLive(product.source)) split.live += product.quantity || 0
          else split.shop += product.quantity || 0
          return split
        },
        { live: 0, shop: 0 }
      )
    const totalOrders = docs.reduce(
      (split, income) => {
        if (income.products.some((product) => this.isLive(product.source))) split.live += 1
        else split.shop += 1
        return split
      },
      { live: 0, shop: 0 }
    )
    return { totalQuantity, totalOrders }
  }

  @Get("kpi-percentage-split-by-month")
  async kpiPercentage(
    @Query("month") month: string,
    @Query("year") year: string,
    @Query("channelId") channelId: string
  ) {
    const [goal, income] = await Promise.all([
      this.goals
        .findOne({
          channel: this.channel(channelId),
          month: Number(month),
          year: Number(year)
        })
        .lean(),
      this.monthlyIncome(month, year, channelId)
    ])
    const totals = income.totalIncome.afterDiscount
    return {
      KPIPercentage: {
        live: goal?.liveStreamGoal ? (totals.live / goal.liveStreamGoal) * 100 : 0,
        shop: goal?.shopGoal ? (totals.shop / goal.shopGoal) * 100 : 0
      }
    }
  }

  @Get("monthly-ads-cost-split")
  async monthlyAds(
    @Query("month") month: string,
    @Query("year") year: string,
    @Query("channelId") channelId: string
  ) {
    const start = new Date(Number(year), Number(month), 1)
    const end = new Date(Number(year), Number(month) + 1, 0, 23, 59, 59, 999)
    const [docs, goal] = await Promise.all([
      this.incomes
        .find({ channel: this.channel(channelId), date: { $gte: start, $lte: end } })
        .lean(),
      this.goals
        .findOne({
          channel: this.channel(channelId),
          month: Number(month),
          year: Number(year)
        })
        .lean()
    ])
    const products = docs.flatMap((income) => income.products)
    const before = this.splitRevenue(products, false)
    const after = this.splitRevenue(products, true)
    const ads = await this.metricsSummary(
      channelId,
      { $gte: start, $lte: end },
      before.totalIncome,
      after.totalIncome
    )
    return {
      ...ads,
      kpi: {
        liveKpi: goal?.liveStreamGoal ?? 0,
        shopKpi: goal?.shopGoal ?? 0,
        liveKpiPercentage: goal?.liveAdsPercentageGoal ?? 0,
        shopKpiPercentage: goal?.shopAdsPercentageGoal ?? 0
      },
      totalIncome: this.monthSplit(products, false)
    }
  }

  @Get("range-stats")
  async rangeStats(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("channelId") channelId: string
  ) {
    const date = this.dates(startDate, endDate)
    const docs = await this.incomes
      .find({ channel: this.channel(channelId), date })
      .lean()
    const products = docs.flatMap((income) => income.products)
    const beforeDiscount = this.splitRevenue(products, false)
    const afterDiscount = this.splitRevenue(products, true)
    const ads = await this.metricsSummary(
      channelId,
      date,
      beforeDiscount.totalIncome,
      afterDiscount.totalIncome
    )
    const totalDiscount = Math.max(
      0,
      beforeDiscount.totalIncome - afterDiscount.totalIncome
    )
    const shippingProviders = Object.entries(
      docs.reduce<Record<string, number>>((totals, income) => {
        const provider = income.shippingProvider || "Chưa xác định"
        totals[provider] = (totals[provider] || 0) + 1
        return totals
      }, {})
    ).map(([provider, orders]) => ({ provider, orders }))
    const productsQuantity = products.reduce<Record<string, number>>(
      (totals, product) => {
        if (product.code) {
          totals[product.code] = (totals[product.code] || 0) + (product.quantity || 0)
        }
        return totals
      },
      {}
    )
    const totalOrders = docs.length
    const liveOrders = docs.filter((income) =>
      income.products.some((product) => this.isLive(product.source))
    ).length
    const days = Math.max(
      1,
      Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime() + 1) /
          86_400_000
      )
    )
    return {
      period: { startDate: new Date(startDate), endDate: new Date(endDate), days },
      current: {
        beforeDiscount,
        afterDiscount,
        boxes: [],
        shippingProviders,
        ads,
        discounts: {
          totalPlatformDiscount: 0,
          totalSellerDiscount: totalDiscount,
          totalDiscount,
          avgDiscountPerOrder: totalOrders ? totalDiscount / totalOrders : 0,
          discountPercentage: beforeDiscount.totalIncome
            ? (totalDiscount / beforeDiscount.totalIncome) * 100
            : 0
        },
        orders: {
          total: totalOrders,
          live: liveOrders,
          shop: totalOrders - liveOrders
        },
        productsQuantity
      }
    }
  }

  @Delete()
  @RequirePermissions("api.incomes.delete-income-by-date")
  async removeByDate(
    @Query("date") dateText: string,
    @Query("channelId") channelId: string
  ) {
    const day = new Date(dateText)
    const next = new Date(day)
    next.setDate(next.getDate() + 1)
    const result = await this.incomes.deleteMany({
      channel: this.channel(channelId),
      date: { $gte: day, $lt: next }
    })
    return { deleted: result.deletedCount }
  }

  @Get("export-xlsx")
  async export(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("channelId") channelId: string,
    @Res() res: any
  ) {
    const docs = await this.incomes
      .find({ channel: this.channel(channelId), date: this.dates(startDate, endDate) })
      .lean()
    const rows = docs.flatMap((income) =>
      income.products.map((product) => ({
        "Order ID": income.orderId,
        "Created Time": income.date,
        "Buyer Username": income.customer,
        "Seller SKU": product.code,
        "Product Name": product.name,
        Quantity: product.quantity,
        Source: product.source,
        "SKU Subtotal Before Discount": product.price,
        "SKU Subtotal After Discount": product.priceAfterDiscount
      }))
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Incomes")
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", "attachment; filename=tratosapp-incomes.xlsx")
    res.send(buffer)
  }

  @Post("insert-and-update-source")
  @RequirePermissions("api.incomes.insert-and-update-affiliate-type")
  @UseInterceptors(FilesInterceptor("files", 2))
  async import(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("channel") channel: string,
    @Body("updateMode") updateMode: string | undefined,
    @Body("chunkIndex") chunkIndex: string | undefined,
    @Body("chunkCount") chunkCount: string | undefined
  ) {
    const input = importInput(files, channel, updateMode, chunkIndex, chunkCount)
    if (!await this.channels.exists({ _id: input.channel })) throw new NotFoundException("Không tìm thấy kênh")
    if (input.mode === "status-only") {
      return {
        success: true,
        message: "Đã cập nhật trạng thái",
        ...(await this.importer.updateStatuses(files[0], input.channel))
      }
    }
    if (input.mode === "affiliate-only") {
      return {
        success: true,
        message: "Đã cập nhật affiliate",
        ...(await this.importer.importAffiliate(files[0], input.channel))
      }
    }
    const total = await this.importer.importTotal(files[0], input.channel)
    const affiliate =
      input.mode === "full"
        ? await this.importer.importAffiliate(files[1], input.channel)
        : undefined
    return {
      success: true,
      message: "Đã import doanh thu",
      ...total,
      affiliateUpdated: affiliate?.updated ?? 0
    }
  }
}
