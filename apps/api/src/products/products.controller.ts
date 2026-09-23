import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { Product, ProductDocument } from "./product.schema"
@ApiTags("products") @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller("products") export class ProductsController {
 constructor(@InjectModel(Product.name) private readonly products: Model<ProductDocument>) {}
 @Get("search") async search(@Query("searchText") q = "", @Query("deleted") deleted = "false") { return this.products.find({ name: { $regex: q, $options: "i" }, deletedAt: deleted === "true" ? { $ne: null } : null }).lean() }
 @Post() create(@Body() body: Partial<Product>) { return this.products.create(body) }
 @Put() update(@Body() body: Partial<Product> & { _id: string }) { return this.products.findByIdAndUpdate(body._id, body, { new: true }) }
 @Delete(":id") remove(@Param("id") id: string) { return this.products.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true }) }
 @Patch(":id/restore") restore(@Param("id") id: string) { return this.products.findByIdAndUpdate(id, { deletedAt: null }, { new: true }) }
}
