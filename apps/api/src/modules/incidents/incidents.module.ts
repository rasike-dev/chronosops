import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ScenarioModule } from "../scenario/scenario.module";
import { IncidentsPersistenceService } from "./incidents.persistence.service";
import { GoogleIntegrationModule } from "../../integrations/google/google.module";
import { CollectorsModule } from "../../collectors/collectors.module";
import { ReasoningModule } from "../../reasoning/reasoning.module";
import { AnalysisCompareService } from "./analysis/analysis-compare.service";
import { InvestigationModule } from "../../investigation/investigation.module";
import { AuditModule } from "../../audit/audit.module";
import { AuditVerifyService } from "./analysis/audit-verify.service";
import { IncidentNormalizer } from "./ingestion/incident-normalizer";

@Module({
  imports: [ScenarioModule, GoogleIntegrationModule, CollectorsModule, ReasoningModule, InvestigationModule, AuditModule],
  controllers: [IncidentsController],
  providers: [IncidentsPersistenceService, AnalysisCompareService, AuditVerifyService, IncidentNormalizer],
  exports: [IncidentsPersistenceService],
})
export class IncidentsModule {}
