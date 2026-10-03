import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import * as bcrypt from "bcryptjs"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"
import { PermissionsGuard } from "./permissions.guard"
import { RequirePermissions } from "./require-permissions.decorator"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./jwt-auth.guard"
import { inputBoolean, inputEmail, inputHttpUrl, inputId, inputObject, inputPassword, inputPermissions, inputString, withDuplicateConflict } from "../common/input-validation"

export const permissionKeys = ["admin.users.manage", "api.products.search-products", "api.products.create-product", "api.products.update-product", "api.products.delete-product", "api.products.restore-product", "api.products.cal-xlsx", "api.incomes.get-incomes-by-date-range", "api.incomes.insert-and-update-affiliate-type", "api.incomes.delete-income-by-date", "api.dailyads.upsert-daily-ads-metrics", "api.dailyads.delete-daily-ads-metrics", "api.livestreammonthgoals.create-livestream-month-goal", "api.livestreammonthgoals.update-livestream-month-goal", "api.packingrules.create-rule", "api.packingrules.update-rule", "api.livestreamchannels.create-livestream-channel", "api.livestreamchannels.update-livestream-channel", "api.livestreamchannels.delete-livestream-channel", "api.storageitems.search-items", "api.storageitems.create-item", "api.storageitems.update-item", "api.storageitems.delete-item", "api.storageitems.restore-item"] as const

@ApiTags("auth") @Controller("users")
export class AuthController {
  constructor(private readonly auth: AuthService, @InjectModel(User.name) private readonly users: Model<UserDocument>) {}
  @Post("login") login(@Body() body: unknown) {
    const value = inputObject(body, ["email", "username", "password"])
    const identity = value.email ?? value.username
    if (typeof identity !== "string" || ("email" in value && "username" in value && value.email !== value.username)) throw new UnauthorizedException()
    return this.auth.login(inputEmail(identity), inputPassword(value.password, "Mật khẩu"))
  }
  @Post("refresh-token") refresh(@Body() body: unknown) {
    const value = inputObject(body, ["refreshToken"])
    return this.auth.refresh(inputString(value.refreshToken, "refreshToken"))
  }
  @Post("check-token") check(@Body() body: unknown) {
    const value = inputObject(body, ["accessToken"])
    return this.auth.check(typeof value.accessToken === "string" ? value.accessToken : "")
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: { user: { sub: string } }) { return this.auth.me(req.user.sub) }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("change-password") changePassword(@Req() req: { user: { sub: string } }, @Body() body: unknown) {
    const value = inputObject(body, ["oldPassword", "newPassword"])
    return this.auth.changePassword(req.user.sub, inputPassword(value.oldPassword, "Mật khẩu hiện tại"), inputPassword(value.newPassword, "Mật khẩu mới", true))
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("update") update(@Req() req: { user: { sub: string } }, @Body() body: unknown) {
    const value = inputObject(body, ["name"])
    return this.auth.updateProfile(req.user.sub, { name: inputString(value.name, "name") })
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("avatar") avatar(@Req() req: { user: { sub: string } }, @Body() body: unknown) {
    const value = inputObject(body, ["avatarUrl"])
    return this.auth.updateProfile(req.user.sub, { avatarUrl: inputHttpUrl(value.avatarUrl, "avatarUrl") })
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("publicsearch") async publicSearch(@Query("searchText") searchText = ""): Promise<any> { const data = await this.users.find({ ...(searchText ? { $or: [{ email: { $regex: searchText, $options: "i" } }, { name: { $regex: searchText, $options: "i" } }] } : {}), active: true }).select("email name avatarUrl").limit(50).lean(); return { data: data.map((user) => ({ ...user, username: user.email })) } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Get("permissions") permissions() { return { data: permissionKeys.map((key) => ({ key, label: key, module: "tiktokshop" })) } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Get("admin/list") async list(@Query("searchText") searchText = "", @Query("page") page = "1", @Query("limit") limit = "50"): Promise<any> { const filter = searchText ? { $or: [{ email: { $regex: searchText, $options: "i" } }, { name: { $regex: searchText, $options: "i" } }] } : {}; const [data, total] = await Promise.all([this.users.find(filter).select("email name avatarUrl active permissions").skip((Math.max(1, Number(page)) - 1) * Number(limit)).limit(Number(limit)).lean(), this.users.countDocuments(filter)]); return { data: data.map((user) => ({ ...user, username: user.email })), total } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Post("admin") async create(@Body() body: unknown) {
    const value = inputObject(body, ["email", "name", "password", "permissions"])
    const email = inputEmail(value.email)
    const name = inputString(value.name, "name")
    const password = inputPassword(value.password, "Mật khẩu", true)
    const permissions = value.permissions === undefined ? [] : inputPermissions(value.permissions, [...permissionKeys, "*"])
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await withDuplicateConflict(() => this.users.create({
      email,
      name,
      passwordHash,
      permissions,
      active: true
    }), "Email đã tồn tại")
    return { _id: user.id, email: user.email, name: user.name }
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Patch("admin/:id") async updateAdmin(@Req() req: { user: { sub: string } }, @Param("id") id: string, @Body() body: unknown) {
    const userId = inputId(id)
    const value = inputObject(body, ["email", "name", "password", "permissions"])
    const email = inputEmail(value.email)
    const name = inputString(value.name, "name")
    const permissions = inputPermissions(value.permissions, [...permissionKeys, "*"])
    if (req.user.sub === userId && !permissions.includes("*") && !permissions.includes("admin.users.manage")) {
      throw new ForbiddenException("Không thể tự gỡ quyền quản lý tài khoản")
    }
    const update: Record<string, unknown> = { email, name, permissions }
    if (value.password !== undefined) update.passwordHash = await bcrypt.hash(inputPassword(value.password, "Mật khẩu", true), 12)
    const user = await withDuplicateConflict(() => this.users.findByIdAndUpdate(userId, update, { new: true, runValidators: true }), "Email đã tồn tại")
    if (!user) throw new NotFoundException("Không tìm thấy user")
    return { message: "Đã cập nhật tài khoản", data: { _id: user.id, email: user.email, name: user.name, permissions: user.permissions } }
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Patch(":id/active") async active(@Req() req: { user: { sub: string } }, @Param("id") id: string, @Body() body: unknown) {
    const userId = inputId(id)
    const value = inputObject(body, ["active"])
    const active = inputBoolean(value.active, "active")
    if (req.user.sub === userId && !active) throw new ForbiddenException("Không thể tự khóa tài khoản")
    const user = await this.users.findByIdAndUpdate(userId, { active }, { new: true, runValidators: true })
    if (!user) throw new NotFoundException("Không tìm thấy user")
    return { message: "Đã cập nhật trạng thái", data: { _id: user.id, active: user.active } }
  }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Patch(":id/permissions") async setPermissions(@Req() req: { user: { sub: string } }, @Param("id") id: string, @Body() body: unknown) {
    const userId = inputId(id)
    const value = inputObject(body, ["permissions"])
    const permissions = inputPermissions(value.permissions, [...permissionKeys, "*"])
    if (req.user.sub === userId && !permissions.includes("*") && !permissions.includes("admin.users.manage")) {
      throw new ForbiddenException("Không thể tự gỡ quyền quản lý tài khoản")
    }
    const user = await this.users.findByIdAndUpdate(userId, { permissions }, { new: true, runValidators: true })
    if (!user) throw new NotFoundException("Không tìm thấy user")
    return { message: "Đã cập nhật quyền", data: { _id: user.id, permissions: user.permissions } }
  }
}
