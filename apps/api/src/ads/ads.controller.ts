import { Body, Controller, Delete, Get, NotFoundException, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { DailyAdsMetrics, DailyAdsMetricsDocument } from "./daily-ads-metrics.schema"
import { calculateAdsMetrics } from "./ads-metrics"
import { inputBusinessDay, inputId, inputNonNegativeNumber, inputObject } from "../common/input-validation"

const inputFields = ["roiProtect", "tinRefundAmount", "gmvAds", "adsManual", "totalRevenue", "refundCancelRate"] as const

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
  for (const field of inputFields) {
    result[field] = field === "adsManual" && body[field] === undefined
      ? 0
      : inputNonNegativeNumber(body[field], field)
  }
  return result
}

@ApiTags("ads") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("dailyads")
export class AdsController {
  constructor(@InjectModel(DailyAdsMetrics.name) private readonly metrics: Model<DailyAdsMetricsDocument>) {}

  @Post("metrics") @RequirePermissions("api.dailyads.upsert-daily-ads-metrics")
  async upsert(@Body() body: unknown) {
    const input = adsMetricsInput(body)
    const { roiProtect, tinRefundAmount, gmvAds, adsManual, totalRevenue, refundCancelRate, date, channelId } = input
    const channel = new Types.ObjectId(channelId)
    const existing = await this.metrics.findOne({ channel, date }).lean()
    const affiliateCost = Number(existing?.affiliateCost ?? 0)
    const data = await this.metrics.findOneAndUpdate(
      { channel, date },
      { $set: {
        channel, date, roiProtect,
        tinRefundAmount, gmvAds, adsManual,
        ...calculateAdsMetrics({
          roiProtect,
          tinRefundAmount,
          gmvAds,
          adsManual,
          affiliateCost,
          totalRevenue,
          refundCancelRate
        })
      } },
      { upsert: true, new: true }
    )
    return { success: true, data }
  }

  @Get("metrics")
  @RequirePermissions("api.incomes.get-incomes-by-date-range")
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
