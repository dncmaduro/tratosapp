import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common"
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "./jwt-auth.guard"

@ApiTags("auth") @Controller("users")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post("login") login(@Body() body: { email?: string; username?: string; password?: string }) { const email = body.email ?? body.username; if (!email || !body.password) throw new UnauthorizedException(); return this.auth.login(email, body.password) }
  @Post("refresh-token") refresh(@Body() body: { refreshToken?: string }) { if (!body.refreshToken) throw new UnauthorizedException(); return this.auth.refresh(body.refreshToken) }
  @Post("check-token") check(@Body() body: { accessToken?: string }) { return this.auth.check(body.accessToken ?? "") }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get("me") me(@Req() req: { user: { sub: string } }) { return this.auth.me(req.user.sub) }
}
