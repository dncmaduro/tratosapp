import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { Channel, ChannelDocument } from "./channel.schema"
@ApiTags("channels") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("channels")
export class ChannelsController {
  constructor(@InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>) {}
  @Get() async list() { return { data: await this.channels.find().sort({ sortOrder: 1, name: 1 }).lean() } }
  @Post() async create(@Body() body: { name: string; username: string; link?: string; sortOrder?: number }) { return this.channels.create(body) }
}
