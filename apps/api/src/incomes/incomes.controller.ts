import { Body, Controller, Delete, Get, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model, Types } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { Income, IncomeDocument } from "./income.schema"
import { FilesInterceptor } from "@nestjs/platform-express"
import { IncomeImportService } from "./income-import.service"
import * as XLSX from "xlsx"

@ApiTags("incomes") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("incomes")
export class IncomesController {
  constructor(@InjectModel(Income.name) private readonly incomes: Model<IncomeDocument>, private readonly importer: IncomeImportService) {}
  @Get() async list(@Query("channelId") channelId?: string, @Query("startDate") startDate?: string, @Query("endDate") endDate?: string, @Query("page") page = "1", @Query("limit") limit = "10", @Query("searchText") searchText = "") {
    const filter: any = {}; if (channelId) filter.channel = new Types.ObjectId(channelId); if (startDate || endDate) filter.date = { ...(startDate ? { $gte: new Date(startDate) } : {}), ...(endDate ? { $lte: new Date(endDate) } : {}) }; if (searchText) filter.$or = [{ orderId: { $regex: searchText, $options: "i" } }, { customer: { $regex: searchText, $options: "i" } }]
    const currentPage = Math.max(1, Number(page)); const size = Math.min(100, Math.max(1, Number(limit))); const [incomes, total] = await Promise.all([this.incomes.find(filter).sort({ date: -1 }).skip((currentPage - 1) * size).limit(size).populate("channel").lean(), this.incomes.countDocuments(filter)])
    return { incomes, total, page: currentPage, limit: size, totalPages: Math.ceil(total / size) }
  }
  @Post() create(@Body() body: Partial<Income>) { return this.incomes.create(body) }
  @Get("income-split-by-month") async monthlyIncome(@Query("month") month: string, @Query("year") year: string, @Query("channelId") channelId: string) { const start = new Date(Number(year), Number(month), 1); const end = new Date(Number(year), Number(month) + 1, 1); const docs = await this.incomes.find({ channel: new Types.ObjectId(channelId), date: { $gte: start, $lt: end } }).lean(); const total = docs.flatMap((d) => d.products).reduce((sum, p) => sum + (p.priceAfterDiscount || p.price || 0) * p.quantity, 0); return { totalIncome: total, totalRevenue: total, count: docs.length } }
  @Get("quantity-split-by-month") async monthlyQuantity(@Query("month") month: string, @Query("year") year: string, @Query("channelId") channelId: string) { const start = new Date(Number(year), Number(month), 1); const end = new Date(Number(year), Number(month) + 1, 1); const docs = await this.incomes.find({ channel: new Types.ObjectId(channelId), date: { $gte: start, $lt: end } }).lean(); return { totalQuantity: docs.flatMap((d) => d.products).reduce((sum, p) => sum + p.quantity, 0) } }
  @Get("range-stats") async rangeStats(@Query("startDate") startDate: string, @Query("endDate") endDate: string, @Query("channelId") channelId: string) { const docs = await this.incomes.find({ channel: new Types.ObjectId(channelId), date: { $gte: new Date(startDate), $lte: new Date(endDate) } }).lean(); const products = docs.flatMap((income) => income.products); const totalRevenue = products.reduce((sum, product) => sum + (product.priceAfterDiscount || product.price || 0) * product.quantity, 0); const totalQuantity = products.reduce((sum, product) => sum + product.quantity, 0); const sourceStats = Object.entries(products.reduce<Record<string, { revenue: number; quantity: number }>>((acc, product) => { const key = product.source || "other"; const value = acc[key] ?? { revenue: 0, quantity: 0 }; value.revenue += (product.priceAfterDiscount || product.price || 0) * product.quantity; value.quantity += product.quantity; acc[key] = value; return acc }, {})).map(([source, value]) => ({ source, ...value })); return { totalRevenue, totalQuantity, totalOrders: docs.length, sourceStats } }
  @Delete() async removeByDate(@Query("date") dateText: string, @Query("channelId") channelId: string) { const day = new Date(dateText); const next = new Date(day); next.setDate(next.getDate() + 1); const result = await this.incomes.deleteMany({ channel: new Types.ObjectId(channelId), date: { $gte: day, $lt: next } }); return { deleted: result.deletedCount } }
  @Get("export-xlsx") async export(@Query("startDate") startDate: string, @Query("endDate") endDate: string, @Query("channelId") channelId: string, @Res() res: any) { const docs = await this.incomes.find({ channel: new Types.ObjectId(channelId), date: { $gte: new Date(startDate), $lte: new Date(endDate) } }).lean(); const rows = docs.flatMap((income) => income.products.map((product) => ({ "Order ID": income.orderId, "Created Time": income.date, "Buyer Username": income.customer, "Seller SKU": product.code, "Product Name": product.name, Quantity: product.quantity, Source: product.source, "SKU Subtotal Before Discount": product.price, "SKU Subtotal After Discount": product.priceAfterDiscount }))); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Incomes"); const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }); res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", "attachment; filename=tratosapp-incomes.xlsx"); res.send(buffer) }
  @Post("insert-and-update-source") @UseInterceptors(FilesInterceptor("files", 2)) async import(@UploadedFiles() files: Express.Multer.File[], @Body("channel") channel: string, @Body("updateMode") updateMode = "full") {
    if (!channel || !files?.length) throw new Error("Thiếu kênh hoặc file import")
    if (updateMode === "status-only") return { success: true, message: "Đã cập nhật trạng thái", ...(await this.importer.updateStatuses(files[0], channel)) }
    if (updateMode === "affiliate-only") return { success: true, message: "Đã cập nhật affiliate", ...(await this.importer.importAffiliate(files[0], channel)) }
    const total = await this.importer.importTotal(files[0], channel)
    const affiliate = updateMode === "full" && files[1] ? await this.importer.importAffiliate(files[1], channel) : undefined
    return { success: true, message: "Đã import doanh thu", ...total, affiliateUpdated: affiliate?.updated ?? 0 }
  }
}
