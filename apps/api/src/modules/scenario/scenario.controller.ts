import { Controller, Get, Param } from "@nestjs/common";
import { ScenarioListSchema } from "@chronosops/contracts";
import { ScenarioService } from "./scenario.service";

@Controller("v1/scenarios")
export class ScenarioController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Get()
  list() {
    return ScenarioListSchema.parse(this.scenarios.list());
  }

  @Get("latency-spike")
  getLatencySpike() {
    return this.scenarios.getLatencySpike();
  }

  @Get(":scenarioId")
  getScenario(@Param("scenarioId") scenarioId: string) {
    return this.scenarios.getById(scenarioId);
  }
}
