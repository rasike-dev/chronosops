import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../auth/public.decorator";

@Controller("v1/ready")
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async getReadiness() {
    // Check database connectivity
    let dbOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (error) {
      // Database connection failed
    }

    // Check if migrations are applied (simple check - try to query a table)
    let migrationsOk = false;
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM "Incident" LIMIT 1`;
      migrationsOk = true;
    } catch (error: any) {
      // Table might not exist if migrations not applied
      if (error?.code === "42P01") {
        // Table does not exist
        migrationsOk = false;
      }
    }

    const ready = dbOk && migrationsOk;

    return {
      ready,
      service: "chronosops-api",
      database: dbOk ? "connected" : "disconnected",
      migrations: migrationsOk ? "applied" : "pending",
      time: new Date().toISOString(),
    };
  }
}
