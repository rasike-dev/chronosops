import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ScenarioSchema, type Scenario } from "@chronosops/contracts";
import { ScenarioPersistenceService } from "./scenario.persistence.service";

const logger = new Logger("ScenarioService");

@Injectable()
export class ScenarioService {
  constructor(private readonly persistence: ScenarioPersistenceService) {}

  /**
   * Get scenario by ID (from database)
   */
  async getById(scenarioId: string): Promise<Scenario> {
    const scenario = await this.persistence.getByScenarioId(scenarioId);
    
    if (!scenario) {
      throw new NotFoundException(`Scenario not found: ${scenarioId}`);
    }

    return ScenarioSchema.parse(scenario);
  }

  /**
   * List all scenarios (from database)
   */
  async list(): Promise<Array<{ scenarioId: string; title: string }>> {
    return this.persistence.list();
  }

  /**
   * Legacy methods for backward compatibility (deprecated - use getById instead)
   * @deprecated Use getById() instead
   */
  getLatencySpike(): Scenario {
    logger.warn("getLatencySpike() is deprecated. Use getById('latency-spike') instead.");
    // This should not be called in production, but kept for backward compatibility
    throw new Error("Legacy method not supported. Use getById('latency-spike') instead.");
  }

  /**
   * Legacy methods for backward compatibility (deprecated - use getById instead)
   * @deprecated Use getById() instead
   */
  getErrorSpikeConfig(): Scenario {
    logger.warn("getErrorSpikeConfig() is deprecated. Use getById('error-spike-config') instead.");
    // This should not be called in production, but kept for backward compatibility
    throw new Error("Legacy method not supported. Use getById('error-spike-config') instead.");
  }
}
