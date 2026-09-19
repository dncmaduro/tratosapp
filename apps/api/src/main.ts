import { ValidationPipe } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix("api/v1")
  app.enableCors({ origin: (process.env.ALLOW_ORIGIN ?? "").split(",").filter(Boolean), credentials: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  SwaggerModule.setup("api/v1/docs", app, SwaggerModule.createDocument(app, new DocumentBuilder().setTitle("Tratosapp API").addBearerAuth().build()))
  await app.listen(Number(process.env.PORT ?? 3000))
}
void bootstrap()
