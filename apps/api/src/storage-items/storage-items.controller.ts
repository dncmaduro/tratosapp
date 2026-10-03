import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { inputId, inputObject, inputString, withDuplicateConflict } from "../common/input-validation"
import { StorageItem, StorageItemDocument } from "./storage-item.schema"

const storageFields = ["code", "name"] as const
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function storageInput(value: unknown) {
  const body = inputObject(value, storageFields)
  return { code: inputString(body.code, "code"), name: inputString(body.name, "name") }
}

function updateInput(value: unknown) {
  const body = inputObject(value, ["_id", ...storageFields])
  return {
    id: inputId(body._id),
    ...storageInput({ code: body.code, name: body.name })
  }
}

function searchInput(searchText: unknown, deleted: unknown) {
  const text = inputString(searchText, "searchText", true)
  if (deleted !== "true" && deleted !== "false") throw new BadRequestException("deleted phải là true hoặc false")
  return { text, deleted: deleted === "true" }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("storageitems")
export class StorageItemsController {
  constructor(@InjectModel(StorageItem.name) private readonly items: Model<StorageItemDocument>) {}

  @Get("search")
  @RequirePermissions("api.products.search-products", "api.storageitems.search-items")
  search(@Query("searchText") searchText: string = "", @Query("deleted") deleted: string = "false") {
    const input = searchInput(searchText, deleted)
    return this.items.find({
      ...(input.text ? { $or: [{ code: { $regex: escapeRegex(input.text), $options: "i" } }, { name: { $regex: escapeRegex(input.text), $options: "i" } }] } : {}),
      deletedAt: input.deleted ? { $ne: null } : null
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

  @Put()
  @RequirePermissions("api.storageitems.update-item")
  async update(@Body() body: unknown) {
    const input = updateInput(body)
    const item = await withDuplicateConflict(
      () => this.items.findByIdAndUpdate(input.id, { $set: { code: input.code, name: input.name } }, { new: true, runValidators: true }),
      "Mã mặt hàng đã tồn tại"
    )
    if (!item) throw new NotFoundException("Không tìm thấy mặt hàng")
    return item
  }

  @Delete(":id")
  @RequirePermissions("api.storageitems.delete-item")
  async remove(@Param("id") id: string) {
    const item = await this.items.findByIdAndUpdate(inputId(id), { $set: { deletedAt: new Date() } }, { new: true })
    if (!item) throw new NotFoundException("Không tìm thấy mặt hàng")
    return item
  }

  @Post(":id/restore")
  @RequirePermissions("api.storageitems.restore-item")
  async restore(@Param("id") id: string) {
    const item = await this.items.findByIdAndUpdate(inputId(id), { $set: { deletedAt: null } }, { new: true })
    if (!item) throw new NotFoundException("Không tìm thấy mặt hàng")
    return item
  }
}
