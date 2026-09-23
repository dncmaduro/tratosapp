import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { Channel, ChannelDocument } from "./channel.schema"

@ApiTags("channels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("channels")
export class ChannelsController {
  constructor(
    @InjectModel(Channel.name) private readonly channels: Model<ChannelDocument>
  ) {}

  @Get()
  async list(
    @Query("searchText") searchText = "",
    @Query("platform") platform = "tiktokshop",
    @Query("page") page = "1",
    @Query("limit") limit = "100"
  ) {
    const filter: Record<string, unknown> = { platform }
    if (searchText) {
      filter.$or = [
        { name: { $regex: searchText, $options: "i" } },
        { username: { $regex: searchText, $options: "i" } }
      ]
    }
    const currentPage = Math.max(1, Number(page))
    const size = Math.min(200, Math.max(1, Number(limit)))
    const [data, total] = await Promise.all([
      this.channels
        .find(filter)
        .sort({ sortOrder: 1, name: 1 })
        .skip((currentPage - 1) * size)
        .limit(size)
        .lean(),
      this.channels.countDocuments(filter)
    ])
    return { data, total }
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const channel = await this.channels.findById(id).lean()
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return channel
  }

  @Post()
  async create(@Body() body: Partial<Channel>) {
    return this.channels.create({
      ...body,
      platform: "tiktokshop",
      usernames: body.usernames?.length ? body.usernames : [body.username]
    })
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Channel>) {
    const channel = await this.channels.findByIdAndUpdate(id, body, { new: true }).lean()
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return channel
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const channel = await this.channels.findByIdAndDelete(id).lean()
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return { success: true }
  }
}
