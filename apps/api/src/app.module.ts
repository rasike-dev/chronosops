import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { ScenarioModule } from "./modules/scenario/scenario.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { VersionModule } from "./modules/version/version.module";

@Module({
  imports: [HealthModule, ScenarioModule, IncidentsModule, VersionModule],
})
export class AppModule {}

