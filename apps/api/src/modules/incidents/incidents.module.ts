import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ScenarioModule } from "../scenario/scenario.module";
import { IncidentsPersistenceService } from "./incidents.persistence.service";
import { GoogleIntegrationModule } from "../../integrations/google/google.module";
import { CollectorsModule } from "../../collectors/collectors.module";
import { ReasoningModule } from "../../reasoning/reasoning.module";
import { AnalysisCompareService } from "./analysis/analysis-compare.service";
import { InvestigationModule } from "../../investigation/investigation.module";

@Module({
  imports: [ScenarioModule, GoogleIntegrationModule, CollectorsModule, ReasoningModule, InvestigationModule],
  controllers: [IncidentsController],
  providers: [IncidentsPersistenceService, AnalysisCompareService],
  exports: [IncidentsPersistenceService],
})
export class IncidentsModule {}
