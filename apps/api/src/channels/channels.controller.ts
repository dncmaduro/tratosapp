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
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { Channel, ChannelDocument } from "./channel.schema"
import { channelInput } from "./channel-input"
import { inputId, withDuplicateConflict } from "../common/input-validation"

@ApiTags("channels")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
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
    const channel = await this.channels.findById(inputId(id)).lean()
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return channel
  }

  @Post()
  @RequirePermissions("api.livestreamchannels.create-livestream-channel")
  async create(@Body() body: unknown) {
    const data = channelInput(body, true)
    return withDuplicateConflict(() => this.channels.create(data), "Username kênh đã tồn tại")
  }

  @Patch(":id")
  @RequirePermissions("api.livestreamchannels.update-livestream-channel")
  async update(@Param("id") id: string, @Body() body: unknown) {
    inputId(id)
    const data = channelInput(body, false)
    const channel = await withDuplicateConflict(
      () => this.channels.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean(),
      "Username kênh đã tồn tại"
    )
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return channel
  }

  @Delete(":id")
  @RequirePermissions("api.livestreamchannels.delete-livestream-channel")
  async remove(@Param("id") id: string) {
    const channel = await this.channels.findByIdAndDelete(inputId(id)).lean()
    if (!channel) throw new NotFoundException("Không tìm thấy kênh")
    return { success: true }
  }
}
