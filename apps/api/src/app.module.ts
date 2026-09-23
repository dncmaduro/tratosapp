import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"
import { JwtModule } from "@nestjs/jwt"
import { HealthController } from "./health.controller"
import { AuthController } from "./auth/auth.controller"
import { AuthService } from "./auth/auth.service"
import { JwtAuthGuard } from "./auth/jwt-auth.guard"
import { User, UserSchema } from "./users/user.schema"
import { Channel, ChannelSchema } from "./channels/channel.schema"
import { ChannelsController } from "./channels/channels.controller"
import { Product, ProductSchema } from "./products/product.schema"
import { ProductsController } from "./products/products.controller"
import { Income, IncomeSchema } from "./incomes/income.schema"
import { DailyAdsMetrics, DailyAdsMetricsSchema } from "./ads/daily-ads-metrics.schema"
import { AdsController } from "./ads/ads.controller"
import { IncomesController } from "./incomes/incomes.controller"
import { IncomeImportService } from "./incomes/income-import.service"
import { MonthGoal, MonthGoalSchema } from "./month-goals/month-goal.schema"
import { MonthGoalsController } from "./month-goals/month-goals.controller"
import { PackingRule, PackingRuleSchema } from "./packing-rules/packing-rule.schema"
import { PackingRulesController } from "./packing-rules/packing-rules.controller"

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MongooseModule.forRoot(process.env.DATABASE_URL ?? "mongodb://127.0.0.1:27017/tratosapp"), MongooseModule.forFeature([{ name: User.name, schema: UserSchema }, { name: Channel.name, schema: ChannelSchema }, { name: Product.name, schema: ProductSchema }, { name: Income.name, schema: IncomeSchema }, { name: DailyAdsMetrics.name, schema: DailyAdsMetricsSchema }, { name: MonthGoal.name, schema: MonthGoalSchema }, { name: PackingRule.name, schema: PackingRuleSchema }]), JwtModule.register({ secret: process.env.JWT_SECRET ?? "development-only-secret" })],
  controllers: [HealthController, AuthController, ChannelsController, ProductsController, AdsController, IncomesController, MonthGoalsController, PackingRulesController], providers: [AuthService, JwtAuthGuard, IncomeImportService]
})
export class AppModule {}
