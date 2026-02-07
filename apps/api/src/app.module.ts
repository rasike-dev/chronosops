import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthModule } from "./modules/health/health.module";
import { ScenarioModule } from "./modules/scenario/scenario.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { VersionModule } from "./modules/version/version.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { GoogleIntegrationModule } from "./integrations/google/google.module";
import { InvestigationModule } from "./investigation/investigation.module";
import { LoggingInterceptor } from "./common/logging/logging.interceptor";

@Module({
  imports: [PrismaModule, HealthModule, ScenarioModule, IncidentsModule, VersionModule, AuthModule, GoogleIntegrationModule, InvestigationModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}

