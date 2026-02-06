import { Controller, Get, Param } from "@nestjs/common";
import { ScenarioListSchema } from "@chronosops/contracts";
import { ScenarioService } from "./scenario.service";
import { Public } from "../../auth/public.decorator";

@Controller("v1/scenarios")
export class ScenarioController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Public()
  @Get()
  list() {
    return ScenarioListSchema.parse(this.scenarios.list());
  }

  @Public()
  @Get("latency-spike")
  getLatencySpike() {
    return this.scenarios.getLatencySpike();
  }

  @Public()
  @Get(":scenarioId")
  getScenario(@Param("scenarioId") scenarioId: string) {
    return this.scenarios.getById(scenarioId);
  }
}
