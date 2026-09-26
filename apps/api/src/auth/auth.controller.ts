import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import * as bcrypt from "bcryptjs"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"
import { PermissionsGuard } from "./permissions.guard"
import { RequirePermissions } from "./require-permissions.decorator"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./jwt-auth.guard"

const permissionKeys = ["api.products.search-products", "api.products.create-product", "api.products.update-product", "api.products.delete-product", "api.products.restore-product", "api.products.cal-xlsx", "api.incomes.get-incomes-by-date-range", "api.incomes.insert-and-update-affiliate-type", "api.incomes.delete-income-by-date", "api.dailyads.upsert-daily-ads-metrics", "api.dailyads.delete-daily-ads-metrics", "api.livestreammonthgoals.create-livestream-month-goal", "api.livestreammonthgoals.update-livestream-month-goal", "api.packingrules.create-rule", "api.packingrules.update-rule", "api.livestreamchannels.create-livestream-channel", "api.livestreamchannels.update-livestream-channel", "api.livestreamchannels.delete-livestream-channel", "api.storageitems.create-item"]

@ApiTags("auth") @Controller("users")
export class AuthController {
  constructor(private readonly auth: AuthService, @InjectModel(User.name) private readonly users: Model<UserDocument>) {}
  @Post("login") login(@Body() body: { email?: string; username?: string; password?: string }) { const email = body.email ?? body.username; if (!email || !body.password) throw new UnauthorizedException(); return this.auth.login(email, body.password) }
  @Post("refresh-token") refresh(@Body() body: { refreshToken?: string }) { if (!body.refreshToken) throw new UnauthorizedException(); return this.auth.refresh(body.refreshToken) }
  @Post("check-token") check(@Body() body: { accessToken?: string }) { return this.auth.check(body.accessToken ?? "") }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: { user: { sub: string } }) { return this.auth.me(req.user.sub) }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("change-password") changePassword(@Req() req: { user: { sub: string } }, @Body() body: { oldPassword: string; newPassword: string }) { if (!body.newPassword || body.newPassword.length < 8) throw new UnauthorizedException("Mật khẩu mới cần ít nhất 8 ký tự"); return this.auth.changePassword(req.user.sub, body.oldPassword, body.newPassword) }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("update") update(@Req() req: { user: { sub: string } }, @Body() body: { name?: string }) { return this.auth.updateProfile(req.user.sub, { name: body.name?.trim() }) }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Patch("avatar") avatar(@Req() req: { user: { sub: string } }, @Body() body: { avatarUrl?: string }) { return this.auth.updateProfile(req.user.sub, { avatarUrl: body.avatarUrl }) }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("publicsearch") async publicSearch(@Query("searchText") searchText = ""): Promise<any> { const data = await this.users.find({ ...(searchText ? { $or: [{ email: { $regex: searchText, $options: "i" } }, { name: { $regex: searchText, $options: "i" } }] } : {}), active: true }).select("email name avatarUrl").limit(50).lean(); return { data: data.map((user) => ({ ...user, username: user.email })) } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Get("permissions") permissions() { return { data: permissionKeys.map((key) => ({ key, label: key, module: "tiktokshop" })) } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Get("admin/list") async list(@Query("searchText") searchText = "", @Query("page") page = "1", @Query("limit") limit = "50"): Promise<any> { const filter = searchText ? { $or: [{ email: { $regex: searchText, $options: "i" } }, { name: { $regex: searchText, $options: "i" } }] } : {}; const [data, total] = await Promise.all([this.users.find(filter).select("email name avatarUrl active permissions").skip((Math.max(1, Number(page)) - 1) * Number(limit)).limit(Number(limit)).lean(), this.users.countDocuments(filter)]); return { data: data.map((user) => ({ ...user, username: user.email })), total } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Post("admin") async create(@Body() body: { email: string; name: string; password: string; permissions?: string[] }) { const user = await this.users.create({ email: body.email.toLowerCase(), name: body.name, passwordHash: await bcrypt.hash(body.password, 12), permissions: body.permissions ?? [], active: true }); return { _id: user.id, email: user.email, name: user.name } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Patch(":id/active") async active(@Param("id") id: string, @Body() body: { active: boolean }) { const user = await this.users.findByIdAndUpdate(id, { active: body.active }, { new: true }); return { message: "Đã cập nhật trạng thái", data: { _id: user?.id, active: user?.active } } }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions("admin.users.manage") @Patch(":id/permissions") async setPermissions(@Param("id") id: string, @Body() body: { permissions: string[] }) { const user = await this.users.findByIdAndUpdate(id, { permissions: body.permissions }, { new: true }); return { message: "Đã cập nhật quyền", data: { _id: user?.id, permissions: user?.permissions ?? [] } } }
}
