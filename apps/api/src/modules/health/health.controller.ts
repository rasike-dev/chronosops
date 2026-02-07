import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../auth/public.decorator";

@Controller("v1/health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getHealth() {
    // Check database connectivity
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (error) {
      // Database connection failed
    }

    return {
      ok: dbOk,
      service: "chronosops-api",
      database: dbOk ? "connected" : "disconnected",
      time: new Date().toISOString(),
    };
  }
}
