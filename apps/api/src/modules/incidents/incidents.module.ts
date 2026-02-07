import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ScenarioModule } from "../scenario/scenario.module";
import { IncidentsPersistenceService } from "./incidents.persistence.service";
import { GoogleIntegrationModule } from "../../integrations/google/google.module";
import { CollectorsModule } from "../../collectors/collectors.module";
import { ReasoningModule } from "../../reasoning/reasoning.module";
import { AnalysisCompareService } from "./analysis/analysis-compare.service";

@Module({
  imports: [ScenarioModule, GoogleIntegrationModule, CollectorsModule, ReasoningModule],
  controllers: [IncidentsController],
  providers: [IncidentsPersistenceService, AnalysisCompareService],
})
export class IncidentsModule {}
