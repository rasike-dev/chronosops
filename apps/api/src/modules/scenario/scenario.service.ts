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

    try {
      return ScenarioSchema.parse(scenario);
    } catch (error: any) {
      // Safely serialize error to avoid Node inspect issues
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      const errorIssues = error?.issues ? JSON.stringify(error.issues, null, 2) : '';
      logger.error(`Failed to parse scenario ${scenarioId}: ${errorMessage}`, errorIssues || '');
      // Log the problematic scenario data for debugging (safely)
      try {
        logger.error(`Scenario data:`, JSON.stringify(scenario, null, 2));
      } catch (stringifyError) {
        logger.error(`Scenario data (partial):`, { scenarioId: scenario?.scenarioId, title: scenario?.title });
      }
      const validationError = error?.issues?.[0]?.message || error?.message || 'Unknown validation error';
      throw new Error(`Invalid scenario data for ${scenarioId}: ${validationError}`);
    }
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
