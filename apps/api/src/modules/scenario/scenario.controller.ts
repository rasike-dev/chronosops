import { Controller, Get, Param } from "@nestjs/common";
import { ScenarioListSchema } from "@chronosops/contracts";
import { ScenarioService } from "./scenario.service";
import { Public } from "../../auth/public.decorator";

@Controller("v1/scenarios")
export class ScenarioController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Public()
  @Get()
  async list() {
    const scenarios = await this.scenarios.list();
    return ScenarioListSchema.parse(scenarios);
  }

  @Public()
  @Get("latency-spike")
  async getLatencySpike() {
    // Backward compatibility - redirect to getById
    return this.scenarios.getById("latency-spike");
  }

  @Public()
  @Get(":scenarioId")
  async getScenario(@Param("scenarioId") scenarioId: string) {
    return await this.scenarios.getById(scenarioId);
  }
}
