import { Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { InjectModel } from "@nestjs/mongoose"
import * as bcrypt from "bcryptjs"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"

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
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, { secret: process.env.JWT_SECRET ?? "development-only-secret" })
      if (payload.type !== "refresh") throw new UnauthorizedException()
      const user = await this.users.findById(payload.sub)
      if (!user || !user.active) throw new UnauthorizedException()
      return { accessToken: await this.signAccess(user), refreshToken: await this.signRefresh(user) }
    } catch { throw new UnauthorizedException("Refresh token không hợp lệ") }
  }
  async check(accessToken: string) { try { await this.jwt.verifyAsync(accessToken); return { valid: true } } catch { return { valid: false } } }
  private signAccess(user: UserDocument) { return this.jwt.signAsync({ sub: user.id, email: user.email }, { expiresIn: "15m" }) }
  private signRefresh(user: UserDocument) { return this.jwt.signAsync({ sub: user.id, type: "refresh" }, { expiresIn: "10d" }) }
  private publicUser(user: UserDocument) { return { _id: user.id, email: user.email, name: user.name, permissions: user.permissions } }
}
