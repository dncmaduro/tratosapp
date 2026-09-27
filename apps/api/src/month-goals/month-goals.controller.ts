import { BadRequestException, Body, Controller, Get, NotFoundException, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { Channel, ChannelDocument } from "../channels/channel.schema"
import { inputId, inputNonNegativeNumber, inputObject, withDuplicateConflict } from "../common/input-validation"
import { MonthGoal, MonthGoalDocument } from "./month-goal.schema"

const goalFields = ["month", "year", "channel", "liveStreamGoal", "shopGoal", "liveAdsPercentageGoal", "shopAdsPercentageGoal"] as const

function goalInput(value: unknown) {
  const body = inputObject(value, goalFields)
  const month = Number(body.month)
  const year = Number(body.year)
  if (!Number.isInteger(month) || month < 0 || month > 11 || !Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new BadRequestException("month hoặc year không hợp lệ")
  }
  const percentage = (field: "liveAdsPercentageGoal" | "shopAdsPercentageGoal") => {
    const result = inputNonNegativeNumber(body[field], field)
    if (result > 100) throw new BadRequestException(`${field} không được lớn hơn 100`)
    return result
  }
  return {
    month,
    year,
    channel: new Types.ObjectId(inputId(body.channel)),
    liveStreamGoal: inputNonNegativeNumber(body.liveStreamGoal, "liveStreamGoal"),
    shopGoal: inputNonNegativeNumber(body.shopGoal, "shopGoal"),
    liveAdsPercentageGoal: percentage("liveAdsPercentageGoal"),
    shopAdsPercentageGoal: percentage("shopAdsPercentageGoal")
  }
}

@ApiTags("month-goals")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("monthgoals")
export class MonthGoalsController {
  constructor(
    @InjectModel(MonthGoal.name) private readonly goals: Model<MonthGoalDocument>,
    @InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>
  ) {}

  @Get("year")
  @RequirePermissions("api.incomes.get-incomes-by-date-range")
  async list(@Query("year") year?: string, @Query("channelId") channelId?: string) {
    const filter: Record<string, unknown> = {}
    if (year) filter.year = Number(year)
    if (channelId) filter.channel = new Types.ObjectId(channelId)
    return { monthGoals: await this.goals.find(filter).populate("channel").sort({ month: 1 }).lean() }
  }

  @Get("month")
  @RequirePermissions("api.incomes.get-incomes-by-date-range")
  async get(@Query("year") year: string, @Query("month") month: string, @Query("channelId") channelId: string) {
    return this.goals.findOne({ year: Number(year), month: Number(month), channel: new Types.ObjectId(channelId) }).populate("channel").lean()
  }

  @Post()
  @RequirePermissions("api.livestreammonthgoals.create-livestream-month-goal")
  async create(@Body() body: unknown) {
    const input = goalInput(body)
    if (!await this.channels.exists({ _id: input.channel })) throw new NotFoundException("Không tìm thấy kênh")
    return withDuplicateConflict(() => this.goals.create(input), "KPI cho tháng và kênh này đã tồn tại")
  }

  @Patch()
  @RequirePermissions("api.livestreammonthgoals.update-livestream-month-goal")
  async update(@Body() body: unknown) {
    const input = goalInput(body)
    if (!await this.channels.exists({ _id: input.channel })) throw new NotFoundException("Không tìm thấy kênh")
    return this.goals.findOneAndUpdate(
      { year: input.year, month: input.month, channel: input.channel },
      { $set: input },
      { new: true, upsert: true, runValidators: true }
    )
  }
}
