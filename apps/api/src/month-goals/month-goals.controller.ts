import { Body, Controller, Get, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { MonthGoal, MonthGoalDocument } from "./month-goal.schema"
@ApiTags("month-goals") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("monthgoals") export class MonthGoalsController {
 constructor(@InjectModel(MonthGoal.name) private readonly goals: Model<MonthGoalDocument>) {}
 @Get("year") async list(@Query("year") year?: string, @Query("channelId") channelId?: string) { const filter: any = {}; if (year) filter.year = Number(year); if (channelId) filter.channel = new Types.ObjectId(channelId); return { monthGoals: await this.goals.find(filter).populate("channel").sort({ month: 1 }).lean() } }
 @Get("month") async get(@Query("year") year: string, @Query("month") month: string, @Query("channelId") channelId: string) { return this.goals.findOne({ year: Number(year), month: Number(month), channel: new Types.ObjectId(channelId) }).populate("channel").lean() }
 @Post() @RequirePermissions("api.livestreammonthgoals.create-livestream-month-goal") create(@Body() body: any) { return this.goals.create({ ...body, channel: new Types.ObjectId(body.channel) }) }
 @Patch() @RequirePermissions("api.livestreammonthgoals.update-livestream-month-goal") update(@Body() body: any) { return this.goals.findOneAndUpdate({ year: body.year, month: body.month, channel: new Types.ObjectId(body.channel) }, body, { new: true, upsert: true }) }
}
