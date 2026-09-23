import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { StorageItem, StorageItemDocument } from "./storage-item.schema"

@UseGuards(JwtAuthGuard)
@Controller("storageitems")
export class StorageItemsController {
  constructor(@InjectModel(StorageItem.name) private readonly items: Model<StorageItemDocument>) {}

  @Get("search")
  search(@Query("searchText") searchText = "", @Query("deleted") deleted = "false") {
    return this.items.find({
      ...(searchText ? { $or: [{ code: { $regex: searchText, $options: "i" } }, { name: { $regex: searchText, $options: "i" } }] } : {}),
      deletedAt: deleted === "true" ? { $ne: null } : null
    }).sort({ name: 1 }).lean()
  }

  @Post()
  create(@Body() body: Pick<StorageItem, "code" | "name">) {
    return this.items.create(body)
  }
}
