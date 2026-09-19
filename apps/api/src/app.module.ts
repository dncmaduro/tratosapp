import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"
import { JwtModule } from "@nestjs/jwt"
import { HealthController } from "./health.controller"
import { AuthController } from "./auth/auth.controller"
import { AuthService } from "./auth/auth.service"
import { JwtAuthGuard } from "./auth/jwt-auth.guard"
import { User, UserSchema } from "./users/user.schema"

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongooseModule.forRoot(process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/tratosapp"), MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), JwtModule.register({ secret: process.env.JWT_SECRET ?? "development-only-secret" })],
  controllers: [HealthController, AuthController], providers: [AuthService, JwtAuthGuard]
})
export class AppModule {}
