import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { PackingRule, PackingRuleDocument } from "./packing-rule.schema"
@ApiTags("packing-rules") @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller("packingrules") export class PackingRulesController {
 constructor(@InjectModel(PackingRule.name) private readonly rules: Model<PackingRuleDocument>) {}
 @Get() async list(@Query("searchText") searchText = "") { const filter = searchText ? { "products.productCode": { $regex: searchText, $options: "i" } } : {}; return { rules: await this.rules.find(filter).lean() } }
 @Post() @RequirePermissions("api.packingrules.create-rule") create(@Body() body: Partial<PackingRule>) { return this.rules.create(body) }
 @Patch(":productCode") @RequirePermissions("api.packingrules.update-rule") async update(@Param("productCode") productCode: string, @Body() body: Partial<PackingRule>) { const rule = await this.rules.findOneAndUpdate({ "products.productCode": productCode }, body, { new: true }); if (!rule) throw new NotFoundException("Không tìm thấy quy tắc đóng hàng"); return rule }
}
