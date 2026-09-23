import { Body, Controller, Delete, Get, NotFoundException, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { DailyAdsMetrics, DailyAdsMetricsDocument } from "./daily-ads-metrics.schema"

@ApiTags("ads") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("dailyads")
export class AdsController {
  constructor(@InjectModel(DailyAdsMetrics.name) private readonly metrics: Model<DailyAdsMetricsDocument>) {}

  @Post("metrics") @RequirePermissions("api.dailyads.upsert-daily-ads-metrics")
  async upsert(@Body() body: any) {
    const rawRate = Number(body.refundCancelRate || 0)
    const refundRate = Math.min(Math.max(rawRate >= 1 ? rawRate / 100 : rawRate, 0), 1)
    const roiProtect = Number(body.roiProtect || 0)
    const tinRefundAmount = Number(body.tinRefundAmount || 0)
    const gmvAds = Number(body.gmvAds || 0)
    const affiliateCost = Number(body.affiliateCost || 0)
    const totalRevenue = Number(body.totalRevenue || 0)
    const actualAdsCost = Math.max(0, gmvAds - tinRefundAmount - roiProtect)
    const affiliateRefundAmount = Math.max(0, actualAdsCost * refundRate)
    const totalCost = Math.max(0, actualAdsCost + affiliateCost)
    const adjustedRevenue = Math.max(0, totalRevenue * (1 - refundRate))
    const costAfterRefund = Math.max(0, totalCost - affiliateRefundAmount)
    const percentage = (value: number, base: number) => base > 0 ? (value / base) * 100 : 0
    const date = new Date(body.date)
    date.setHours(0, 0, 0, 0)
    const data = await this.metrics.findOneAndUpdate(
      { channel: new Types.ObjectId(body.channelId), date },
      { $set: {
        channel: new Types.ObjectId(body.channelId), date, roiProtect,
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
    const date = new Date(dateText); date.setHours(0, 0, 0, 0)
    const data = await this.metrics.findOne({ date, channel: new Types.ObjectId(channelId) }).lean()
    if (!data) throw new NotFoundException("Không tìm thấy dữ liệu ads")
    return data
  }

  @Delete("metrics/delete") @RequirePermissions("api.dailyads.delete-daily-ads-metrics")
  async remove(@Body() body: { date: string; channelId: string }) {
    const date = new Date(body.date); date.setHours(0, 0, 0, 0)
    await this.metrics.deleteOne({ date, channel: new Types.ObjectId(body.channelId) })
    return { success: true }
  }
}
