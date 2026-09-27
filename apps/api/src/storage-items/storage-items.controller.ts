import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { inputObject, inputString, withDuplicateConflict } from "../common/input-validation"
import { StorageItem, StorageItemDocument } from "./storage-item.schema"

const storageFields = [
  "code", "name", "quantityPerBox", "receivedQuantity", "deliveredQuantity", "restQuantity", "note"
] as const

function storageInput(value: unknown) {
  const body = inputObject(value, storageFields)
  // The existing quick-create form still sends old inventory counters. This
  // extracted schema intentionally stores only code and name.
  return { code: inputString(body.code, "code"), name: inputString(body.name, "name") }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
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
  @RequirePermissions("api.storageitems.create-item")
  create(@Body() body: unknown) {
    return withDuplicateConflict(
      () => this.items.create(storageInput(body)),
      "Mã mặt hàng đã tồn tại"
    )
  }
}
