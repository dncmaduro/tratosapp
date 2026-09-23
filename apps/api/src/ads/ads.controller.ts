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
  @Post("metrics") @RequirePermissions("api.dailyads.upsert-daily-ads-metrics") async upsert(@Body() body: any) {
    const refundCancelRate = Math.min(Math.max(Number(body.refundCancelRate || 0) > 1 ? Number(body.refundCancelRate) / 100 : Number(body.refundCancelRate || 0), 0), 1)
    const actualAdsCost = Math.max(0, Number(body.gmvAds || 0) - Number(body.tinRefundAmount || 0) - Number(body.roiProtect || 0))
    const totalCost = actualAdsCost + Number(body.affiliateCost || 0)
    const adjustedRevenue = Math.max(0, Number(body.totalRevenue || 0) * (1 - refundCancelRate))
    const costAfterRefund = Math.max(0, totalCost - actualAdsCost * refundCancelRate)
    const date = new Date(body.date); date.setHours(0, 0, 0, 0)
    const data = await this.metrics.findOneAndUpdate({ channel: new Types.ObjectId(body.channelId), date }, { $set: { ...body, channel: new Types.ObjectId(body.channelId), date, refundCancelRate, actualAdsCost, totalCost, adjustedRevenue, costAfterRefund } }, { upsert: true, new: true })
    return { success: true, data }
  }
  @Get("metrics") async get(@Query("date") dateText: string, @Query("channelId") channelId: string) { const date = new Date(dateText); date.setHours(0, 0, 0, 0); const data = await this.metrics.findOne({ date, channel: new Types.ObjectId(channelId) }).lean(); if (!data) throw new NotFoundException("Không tìm thấy dữ liệu ads"); return data }
  @Delete("metrics/delete") @RequirePermissions("api.dailyads.delete-daily-ads-metrics") async remove(@Body() body: { date: string; channelId: string }) { const date = new Date(body.date); date.setHours(0, 0, 0, 0); await this.metrics.deleteOne({ date, channel: new Types.ObjectId(body.channelId) }); return { success: true } }
}
