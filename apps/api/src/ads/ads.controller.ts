import { Body, Controller, Delete, Get, NotFoundException, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { DailyAdsMetrics, DailyAdsMetricsDocument } from "./daily-ads-metrics.schema"
import { inputBusinessDay, inputId, inputNonNegativeNumber, inputObject } from "../common/input-validation"

const inputFields = ["roiProtect", "tinRefundAmount", "gmvAds", "affiliateCost", "totalRevenue", "refundCancelRate"] as const

type AdsMetricsInput = Record<(typeof inputFields)[number], number> & {
  date: Date
  channelId: string
}

function adsMetricsInput(value: unknown): AdsMetricsInput {
  const body = inputObject(value, ["date", "channelId", ...inputFields])
  const result = {
    date: inputBusinessDay(body.date),
    channelId: inputId(body.channelId)
  } as AdsMetricsInput
  for (const field of inputFields) result[field] = inputNonNegativeNumber(body[field], field)
  return result
}

@ApiTags("ads") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("dailyads")
export class AdsController {
  constructor(@InjectModel(DailyAdsMetrics.name) private readonly metrics: Model<DailyAdsMetricsDocument>) {}

  @Post("metrics") @RequirePermissions("api.dailyads.upsert-daily-ads-metrics")
  async upsert(@Body() body: unknown) {
    const input = adsMetricsInput(body)
    const rawRate = input.refundCancelRate
    const refundRate = Math.min(Math.max(rawRate >= 1 ? rawRate / 100 : rawRate, 0), 1)
    const { roiProtect, tinRefundAmount, gmvAds, affiliateCost, totalRevenue, date, channelId } = input
    const actualAdsCost = Math.max(0, gmvAds - tinRefundAmount - roiProtect)
    const affiliateRefundAmount = Math.max(0, actualAdsCost * refundRate)
    const totalCost = Math.max(0, actualAdsCost + affiliateCost)
    const adjustedRevenue = Math.max(0, totalRevenue * (1 - refundRate))
    const costAfterRefund = Math.max(0, totalCost - affiliateRefundAmount)
    const percentage = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0
    const channel = new Types.ObjectId(channelId)
    const data = await this.metrics.findOneAndUpdate(
      { channel, date },
      { $set: {
        channel, date, roiProtect,
        refundCancelRate: Math.round(refundRate * 10_000) / 100,
        fullRefundGmv: 0, tinRefundAmount, adsTax: 0, gmvAds, affiliateCost,
        affiliateRefundAmount, totalRevenue, adjustedRevenue,
        incomeBeforeDiscount: totalRevenue, incomeAfterDiscount: totalRevenue,
        actualAdsCost, totalCost, costAfterRefund,
        adsRatioOnBeforeDiscountRevenue: percentage(actualAdsCost, totalRevenue),
        totalCostRatioOnBeforeDiscountRevenue: percentage(totalCost, totalRevenue),
        costAfterRefundRatioOnBeforeDiscountRevenue: percentage(totalCost, adjustedRevenue),
        affiliateRatioOnBeforeDiscountRevenue: 0
      } },
      { upsert: true, new: true }
    )
    return { success: true, data }
  }

  @Get("metrics")
  async get(@Query("date") dateText: string, @Query("channelId") channelId: string) {
    const date = inputBusinessDay(dateText)
    const data = await this.metrics.findOne({ date, channel: new Types.ObjectId(inputId(channelId)) }).lean()
    if (!data) throw new NotFoundException("Không tìm thấy dữ liệu ads")
    return data
  }

  @Delete("metrics/delete") @RequirePermissions("api.dailyads.delete-daily-ads-metrics")
  async remove(@Body() body: unknown) {
    const input = inputObject(body, ["date", "channelId"])
    const date = inputBusinessDay(input.date)
    await this.metrics.deleteOne({ date, channel: new Types.ObjectId(inputId(input.channelId)) })
    return { success: true }
  }
}
