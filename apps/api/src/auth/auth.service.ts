import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { InjectModel } from "@nestjs/mongoose"
import * as bcrypt from "bcryptjs"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"

type AuthTokenPayload = {
  sub: string
  type: "access" | "refresh"
  email?: string
}

@Injectable()
export class AuthService {
  constructor(@InjectModel(User.name) private readonly users: Model<UserDocument>, private readonly jwt: JwtService) {}
  async login(email: string, password: string) {
    const user = await this.users.findOne({ email: email.toLowerCase() })
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException("Email hoặc mật khẩu không đúng")
    return { accessToken: await this.signAccess(user), refreshToken: await this.signRefresh(user), user: this.publicUser(user) }
  }
  async me(id: string) { const user = await this.users.findById(id); if (!user || !user.active) throw new UnauthorizedException(); return this.publicUser(user) }
  async refresh(refreshToken: string) {
    const payload = await this.verifyToken(refreshToken, "refresh")
    const user = await this.users.findById(payload.sub)
    if (!user || !user.active) throw new UnauthorizedException()
    return { accessToken: await this.signAccess(user), refreshToken: await this.signRefresh(user) }
  }

  async verifyAccessToken(accessToken: string): Promise<AuthTokenPayload> {
    const payload = await this.verifyToken(accessToken, "access")
    const user = await this.users.findById(payload.sub)
    if (!user || !user.active) throw new UnauthorizedException()
    return payload
  }

  private async verifyToken(token: string, type: AuthTokenPayload["type"]): Promise<AuthTokenPayload> {
    let payload: AuthTokenPayload
    try {
      payload = await this.jwt.verifyAsync<AuthTokenPayload>(token)
    } catch {
      throw new UnauthorizedException("Token không hợp lệ hoặc đã hết hạn")
    }
    if (!payload || payload.type !== type || typeof payload.sub !== "string" || !/^[a-f\d]{24}$/i.test(payload.sub)) {
      throw new UnauthorizedException("Token không hợp lệ")
    }
    return payload
  }

  async check(accessToken: string) {
    try {
      await this.verifyAccessToken(accessToken)
      return { valid: true }
    } catch (error) {
      if (error instanceof UnauthorizedException) return { valid: false }
      throw error
    }
  }
  async changePassword(id: string, oldPassword: string, newPassword: string) { const user = await this.users.findById(id); if (!user || !(await bcrypt.compare(oldPassword, user.passwordHash))) throw new UnauthorizedException("Mật khẩu hiện tại không đúng"); user.passwordHash = await bcrypt.hash(newPassword, 12); await user.save(); return { message: "Đã đổi mật khẩu" } }
  async updateProfile(id: string, body: { name?: string; avatarUrl?: string }) { await this.users.findByIdAndUpdate(id, { $set: body }); return { message: "Đã cập nhật hồ sơ" } }
  private signAccess(user: UserDocument) { return this.jwt.signAsync({ sub: user.id, email: user.email, type: "access" }, { expiresIn: "15m" }) }
  private signRefresh(user: UserDocument) { return this.jwt.signAsync({ sub: user.id, type: "refresh" }, { expiresIn: "10d" }) }
  private publicUser(user: UserDocument) { return { _id: user.id, email: user.email, username: user.email, name: user.name, avatarUrl: user.avatarUrl, permissions: user.permissions, active: user.active } }
}
