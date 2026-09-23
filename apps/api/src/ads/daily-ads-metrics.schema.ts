import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Types } from "mongoose"
export type DailyAdsMetricsDocument = HydratedDocument<DailyAdsMetrics>
@Schema({ timestamps: true }) export class DailyAdsMetrics { @Prop({ required: true }) date!: Date; @Prop({ type: Types.ObjectId, ref: "Channel", required: true }) channel!: Types.ObjectId; @Prop({ default: 0 }) roiProtect!: number; @Prop({ default: 0 }) tinRefundAmount!: number; @Prop({ default: 0 }) gmvAds!: number; @Prop({ default: 0 }) affiliateCost!: number; @Prop({ default: 0 }) totalRevenue!: number; @Prop({ default: 0 }) refundCancelRate!: number; @Prop({ default: 0 }) actualAdsCost!: number; @Prop({ default: 0 }) totalCost!: number; @Prop({ default: 0 }) adjustedRevenue!: number; @Prop({ default: 0 }) costAfterRefund!: number }
export const DailyAdsMetricsSchema = SchemaFactory.createForClass(DailyAdsMetrics); DailyAdsMetricsSchema.index({ channel: 1, date: 1 }, { unique: true })
