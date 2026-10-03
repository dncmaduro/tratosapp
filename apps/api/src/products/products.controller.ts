import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import * as XLSX from "xlsx"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { inputId, inputNonNegativeNumber, inputObject, inputString, withDuplicateConflict } from "../common/input-validation"
import { StorageItem, StorageItemDocument } from "../storage-items/storage-item.schema"
import { Product, ProductDocument } from "./product.schema"

const productFields = ["name", "items"] as const
const productUpdateFields = ["_id", "deletedAt", ...productFields] as const
const productItemFields = ["_id", "quantity"] as const
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function searchInput(searchText: unknown, deleted: unknown) {
  const text = inputString(searchText, "searchText", true)
  if (deleted !== "true" && deleted !== "false") throw new BadRequestException("deleted phải là true hoặc false")
  return { text, deleted: deleted === "true" }
}

type ProductInput = { id?: string; name: string; items: { _id: string; quantity: number }[] }

function productInput(value: unknown, updating = false): ProductInput {
  const body = inputObject(value, updating ? productUpdateFields : productFields)
  if (!Array.isArray(body.items)) throw new BadRequestException("items phải là một mảng")
  const items = body.items.map((item) => {
    const value = inputObject(item, productItemFields)
    const quantity = inputNonNegativeNumber(value.quantity, "items.quantity")
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new BadRequestException("items.quantity phải là số nguyên dương")
    }
    return { _id: inputId(value._id), quantity }
  })
  if (new Set(items.map((item) => item._id)).size !== items.length) {
    throw new BadRequestException("items không được trùng mặt hàng")
  }
  return { id: updating ? inputId(body._id) : undefined, name: inputString(body.name, "name"), items }
}

@ApiTags("products") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("products")
export class ProductsController {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(StorageItem.name) private readonly items: Model<StorageItemDocument>
  ) {}

  @Get("search")
  @RequirePermissions("api.products.search-products")
  search(@Query("searchText") searchText: string = "", @Query("deleted") deleted: string = "false") {
    const input = searchInput(searchText, deleted)
    return this.products.find({ name: { $regex: escapeRegex(input.text), $options: "i" }, deletedAt: input.deleted ? { $ne: null } : null }).lean()
  }

  @Post() @RequirePermissions("api.products.create-product")
  async create(@Body() body: unknown) {
    const input = productInput(body)
    await this.ensureItemsExist(input.items)
    return withDuplicateConflict(() => this.products.create({ name: input.name, items: input.items }), "SKU đã tồn tại")
  }

  @Put() @RequirePermissions("api.products.update-product")
  async update(@Body() body: unknown) {
    const input = productInput(body, true)
    await this.ensureItemsExist(input.items)
    const product = await withDuplicateConflict(
      () => this.products.findByIdAndUpdate(input.id, { $set: { name: input.name, items: input.items } }, { new: true, runValidators: true }),
      "SKU đã tồn tại"
    )
    if (!product) throw new NotFoundException("Không tìm thấy SKU")
    return product
  }

  @Delete(":id") @RequirePermissions("api.products.delete-product")
  async remove(@Param("id") id: string) {
    const product = await this.products.findByIdAndUpdate(inputId(id), { deletedAt: new Date() }, { new: true })
    if (!product) throw new NotFoundException("Không tìm thấy SKU")
    return product
  }

  @Patch(":id/restore") @RequirePermissions("api.products.restore-product")
  async restore(@Param("id") id: string) {
    const product = await this.products.findByIdAndUpdate(inputId(id), { deletedAt: null }, { new: true })
    if (!product) throw new NotFoundException("Không tìm thấy SKU")
    return product
  }

  @Post("cal-xlsx") @RequirePermissions("api.products.cal-xlsx") @UseInterceptors(FileInterceptor("file"))
  async calXlsx(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Thiếu file XLSX")
    const book = XLSX.read(file.buffer, { type: "buffer" })
    const sheet = book.Sheets[book.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    const headers = (rows[0] ?? []).map((cell) => String(cell ?? "").trim())
    const sku = headers.indexOf("Seller SKU"), quantity = headers.indexOf("Quantity"), orderId = headers.indexOf("Order ID"), status = headers.indexOf("Order Status")
    if (sku < 0 || quantity < 0 || orderId < 0) throw new BadRequestException("File thiếu cột Seller SKU, Quantity hoặc Order ID")
    const lines = rows.slice(1).map((row) => ({ sku: String(row[sku] ?? "").trim(), quantity: Number(row[quantity]) || 0, orderId: String(row[orderId] ?? "").trim(), status: String(status >= 0 ? row[status] ?? "" : "").trim() })).filter((row) => row.sku && row.orderId && row.status !== "Đã hủy")
    const products = await this.products.find({ name: { $in: [...new Set(lines.map((line) => line.sku))] }, deletedAt: null }).lean()
    const productsByName = new Map(products.map((product) => [product.name, product]))
    const quantities: Record<string, number> = {}, orders: Record<string, { name: string; quantity: number }[]> = {}
    for (const line of lines) {
      const product = productsByName.get(line.sku)
      if (!product) continue
      for (const item of product.items) quantities[item._id] = (quantities[item._id] || 0) + item.quantity * line.quantity
      ;(orders[line.orderId] ||= []).push({ name: line.sku, quantity: line.quantity })
    }
    const itemDocs = await this.items.find({ _id: { $in: Object.keys(quantities) } }).lean()
    const grouped: Record<string, { products: { name: string; quantity: number }[]; quantity: number }> = {}
    for (const productsInOrder of Object.values(orders)) {
      const key = productsInOrder.map((item) => `${item.name}${item.quantity}`).sort().join(",")
      ;(grouped[key] ||= { products: productsInOrder, quantity: 0 }).quantity += 1
    }
    return { items: itemDocs.map((item) => ({ _id: item._id.toString(), name: item.name, quantity: quantities[item._id.toString()] || 0, storageItems: [item] })), orders: Object.values(grouped), total: Object.values(grouped).reduce((sum, order) => sum + order.quantity, 0) }
  }

  private async ensureItemsExist(items: ProductInput["items"]) {
    if (!items.length) return
    const stored = await this.items.find({ _id: { $in: items.map((item) => item._id) }, deletedAt: null }).select("_id").lean()
    if (stored.length !== items.length) throw new NotFoundException("Có mặt hàng không tồn tại")
  }
}
