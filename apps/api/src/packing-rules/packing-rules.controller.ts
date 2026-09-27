import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { Model } from "mongoose"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PermissionsGuard } from "../auth/permissions.guard"
import { RequirePermissions } from "../auth/require-permissions.decorator"
import { inputNonNegativeNumber, inputObject, inputString } from "../common/input-validation"
import { PackingRule, PackingRuleDocument } from "./packing-rule.schema"

const packingTypes = ["small", "square", "big", "big-35", "long"]
const ruleFields = ["packingType", "products"] as const
const ruleProductFields = ["productCode", "minQuantity", "maxQuantity"] as const

function quantity(value: unknown, field: string) {
  if (value === null) return null
  const result = inputNonNegativeNumber(value, field)
  if (!Number.isSafeInteger(result) || result < 1) throw new BadRequestException(`${field} phải là số nguyên dương hoặc null`)
  return result
}

function ruleInput(value: unknown): PackingRule {
  const body = inputObject(value, ruleFields)
  const packingType = inputString(body.packingType, "packingType")
  if (!packingTypes.includes(packingType)) throw new BadRequestException("packingType không hợp lệ")
  if (!Array.isArray(body.products) || !body.products.length) throw new BadRequestException("products phải là mảng không rỗng")
  const products = body.products.map((item) => {
    const product = inputObject(item, ruleProductFields)
    const minQuantity = quantity(product.minQuantity, "products.minQuantity")
    const maxQuantity = quantity(product.maxQuantity, "products.maxQuantity")
    if (minQuantity !== null && maxQuantity !== null && maxQuantity < minQuantity) {
      throw new BadRequestException("products.maxQuantity phải lớn hơn hoặc bằng products.minQuantity")
    }
    return { productCode: inputString(product.productCode, "products.productCode"), minQuantity, maxQuantity }
  })
  if (new Set(products.map((product) => product.productCode)).size !== products.length) {
    throw new BadRequestException("products không được trùng productCode")
  }
  return { packingType, products }
}

@ApiTags("packing-rules")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("packingrules")
export class PackingRulesController {
  constructor(@InjectModel(PackingRule.name) private readonly rules: Model<PackingRuleDocument>) {}

  @Get()
  @RequirePermissions("api.incomes.get-incomes-by-date-range")
  async list(@Query("searchText") searchText = "") {
    const filter = searchText ? { "products.productCode": { $regex: searchText, $options: "i" } } : {}
    return { rules: await this.rules.find(filter).lean() }
  }

  @Post()
  @RequirePermissions("api.packingrules.create-rule")
  create(@Body() body: unknown) {
    return this.rules.create(ruleInput(body))
  }

  @Patch(":productCode")
  @RequirePermissions("api.packingrules.update-rule")
  async update(@Param("productCode") productCode: string, @Body() body: unknown) {
    const input = ruleInput(body)
    const code = inputString(productCode, "productCode")
    if (!input.products.some((product) => product.productCode === code)) {
      throw new BadRequestException("products phải giữ productCode đang cập nhật")
    }
    const rule = await this.rules.findOneAndUpdate(
      { "products.productCode": code },
      { $set: input },
      { new: true, runValidators: true }
    )
    if (!rule) throw new NotFoundException("Không tìm thấy quy tắc đóng hàng")
    return rule
  }
}
