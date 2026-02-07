import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { ReadinessController } from "./readiness.controller";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, ReadinessController],
})
export class HealthModule {}
