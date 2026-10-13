import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Types } from "mongoose"

export const bookingMetricTypes = ["freecast", "paid_cast"] as const
export type BookingMetricType = (typeof bookingMetricTypes)[number]
export type DailyBookingMetricsDocument = HydratedDocument<DailyBookingMetrics>

@Schema({ timestamps: true })
export class DailyBookingMetrics {
  @Prop({ required: true }) date!: Date
  @Prop({ type: Types.ObjectId, ref: "Channel", required: true }) channel!: Types.ObjectId
  @Prop({ required: true, enum: bookingMetricTypes }) type!: BookingMetricType
  @Prop({ default: 0 }) kocCount!: number
  @Prop({ default: 0 }) productShippingCost!: number
  @Prop({ default: 0 }) castFee!: number
}

export const DailyBookingMetricsSchema = SchemaFactory.createForClass(DailyBookingMetrics)
DailyBookingMetricsSchema.index({ channel: 1, date: 1, type: 1 }, { unique: true })
