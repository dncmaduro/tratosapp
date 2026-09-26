import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { AuthService } from "./auth.service"
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest()
    const authorization: unknown = request.headers.authorization
    if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
      throw new UnauthorizedException()
    }
    request.user = await this.auth.verifyAccessToken(authorization.slice(7))
    return true
  }
}
