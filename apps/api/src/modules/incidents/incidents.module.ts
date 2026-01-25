import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ScenarioModule } from "../scenario/scenario.module";
import { IncidentsPersistenceService } from "./incidents.persistence.service";

@Module({
  imports: [ScenarioModule],
  controllers: [IncidentsController],
  providers: [IncidentsPersistenceService],
})
export class IncidentsModule {}
