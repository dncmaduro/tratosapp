import { BadRequestException, Body, Controller, Delete, Get, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { inputBusinessDay, inputId, inputNonNegativeNumber, inputObject } from "../common/input-validation"
import {
  bookingMetricTypes,
  BookingMetricType,
  DailyBookingMetrics,
  DailyBookingMetricsDocument
} from "./daily-booking-metrics.schema"

const inputFields = ["kocCount", "productShippingCost", "castFee"] as const

type BookingMetricsInput = Record<(typeof inputFields)[number], number> & {
  date: Date
  channelId: string
  type: BookingMetricType
}

function inputBookingType(value: unknown): BookingMetricType {
  if (typeof value !== "string" || !bookingMetricTypes.includes(value as BookingMetricType)) {
    throw new BadRequestException("type phải là freecast hoặc paid_cast")
  }
  return value as BookingMetricType
}

function bookingMetricsInput(value: unknown): BookingMetricsInput {
  const body = inputObject(value, ["date", "channelId", "type", ...inputFields])
  const result = {
    date: inputBusinessDay(body.date),
    channelId: inputId(body.channelId),
    type: inputBookingType(body.type)
  } as BookingMetricsInput
  for (const field of inputFields) result[field] = inputNonNegativeNumber(body[field], field)
  return result
}

@ApiTags("bookings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("dailybookings")
export class BookingsController {
  constructor(@InjectModel(DailyBookingMetrics.name) private readonly metrics: Model<DailyBookingMetricsDocument>) {}

  @Post("metrics")
  @RequirePermissions("api.dailybooking.upsert-daily-booking-metrics")
  async upsert(@Body() body: unknown) {
    const input = bookingMetricsInput(body)
    const channel = new Types.ObjectId(input.channelId)
    const data = await this.metrics.findOneAndUpdate(
      { channel, date: input.date, type: input.type },
      {
        $set: {
          channel,
          date: input.date,
          type: input.type,
          kocCount: input.kocCount,
          productShippingCost: input.productShippingCost,
          castFee: input.castFee
        }
      },
      { upsert: true, new: true }
    )
    return { success: true, data }
  }

  @Get("metrics")
  @RequirePermissions("api.incomes.get-incomes-by-date-range")
  async get(
    @Query("channelId") channelId: string,
    @Query("fromDate") fromDateText: string,
    @Query("toDate") toDateText: string
  ) {
    const fromDate = inputBusinessDay(fromDateText, "fromDate")
    const toDate = inputBusinessDay(toDateText, "toDate")
    if (fromDate > toDate) throw new BadRequestException("fromDate không được lớn hơn toDate")

    const data = await this.metrics
      .find({
        channel: new Types.ObjectId(inputId(channelId)),
        date: { $gte: fromDate, $lte: toDate }
      })
      .sort({ date: -1, type: 1 })
      .lean()

    return { data }
  }

  @Delete("metrics/delete")
  @RequirePermissions("api.dailybooking.delete-daily-booking-metrics")
  async remove(@Body() body: unknown) {
    const input = inputObject(body, ["date", "channelId", "type"])
    const date = inputBusinessDay(input.date)
    const channel = new Types.ObjectId(inputId(input.channelId))
    const type = inputBookingType(input.type)
    await this.metrics.deleteOne({ date, channel, type })
    return { success: true }
  }
}
