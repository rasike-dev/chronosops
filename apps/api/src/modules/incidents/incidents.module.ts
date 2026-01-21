import { Module } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { ScenarioModule } from "../scenario/scenario.module";

@Module({
  imports: [ScenarioModule],
  controllers: [IncidentsController],
})
export class IncidentsModule {}
