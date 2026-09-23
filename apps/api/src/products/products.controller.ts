import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import * as XLSX from "xlsx"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { StorageItem, StorageItemDocument } from "../storage-items/storage-item.schema"
import { Product, ProductDocument } from "./product.schema"

@ApiTags("products") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("products")
export class ProductsController {
  constructor(
    @InjectModel(Product.name) private readonly products: Model<ProductDocument>,
    @InjectModel(StorageItem.name) private readonly items: Model<StorageItemDocument>
  ) {}

  @Get("search")
  search(@Query("searchText") q = "", @Query("deleted") deleted = "false") {
    return this.products.find({ name: { $regex: q, $options: "i" }, deletedAt: deleted === "true" ? { $ne: null } : null }).lean()
  }

  @Post() @RequirePermissions("api.products.create-product")
  create(@Body() body: Partial<Product>) { return this.products.create(body) }

  @Put() @RequirePermissions("api.products.update-product")
  update(@Body() body: Partial<Product> & { _id: string }) { return this.products.findByIdAndUpdate(body._id, body, { new: true }) }

  @Delete(":id") @RequirePermissions("api.products.delete-product")
  remove(@Param("id") id: string) { return this.products.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }) }

  @Patch(":id/restore") @RequirePermissions("api.products.restore-product")
  restore(@Param("id") id: string) { return this.products.findByIdAndUpdate(id, { deletedAt: null }, { new: true }) }

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
}
