import { Module } from "@nestjs/common";
import { ScenarioController } from "./scenario.controller";
import { ScenarioService } from "./scenario.service";
import { ScenarioPersistenceService } from "./scenario.persistence.service";
import { PrismaModule } from "../../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ScenarioController],
  providers: [ScenarioService, ScenarioPersistenceService],
  exports: [ScenarioService, ScenarioPersistenceService],
})
export class ScenarioModule {}
