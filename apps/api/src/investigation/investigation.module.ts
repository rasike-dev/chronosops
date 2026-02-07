import { Module, forwardRef } from "@nestjs/common";
import { InvestigationService } from "./investigation.service";
import { InvestigationController } from "./investigation.controller";
import { CollectorsModule } from "../collectors/collectors.module";
import { ReasoningModule } from "../reasoning/reasoning.module";
import { PrismaModule } from "../prisma/prisma.module";
import { IncidentsModule } from "../modules/incidents/incidents.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    PrismaModule,
    CollectorsModule,
    ReasoningModule,
    AuditModule,
    forwardRef(() => IncidentsModule),
  ],
  controllers: [InvestigationController],
  providers: [InvestigationService],
  exports: [InvestigationService],
})
export class InvestigationModule {}
