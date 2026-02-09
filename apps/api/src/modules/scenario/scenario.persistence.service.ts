import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Scenario } from '@chronosops/contracts';

@Injectable()
export class ScenarioPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get scenario by scenarioId
   */
  async getByScenarioId(scenarioId: string): Promise<Scenario | null> {
    const record = await this.prisma.scenario.findUnique({
      where: { scenarioId },
    });

    if (!record) {
      return null;
    }

    return this.mapToScenario(record);
  }

  /**
   * List all scenarios (for dropdown/selection)
   */
  async list(): Promise<Array<{ scenarioId: string; title: string }>> {
    const records = await this.prisma.scenario.findMany({
      select: {
        scenarioId: true,
        title: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return records;
  }

  /**
   * Create or update a scenario
   */
  async upsert(params: {
    scenarioId: string;
    title: string;
    description: string;
    deploymentId: string;
    serviceId: string;
    versionFrom: string;
    versionTo: string;
    deploymentTimestamp: Date;
    metrics: any[];
    tags?: string[];
    category?: string;
    severity?: string;
  }): Promise<Scenario> {
    const record = await this.prisma.scenario.upsert({
      where: { scenarioId: params.scenarioId },
      create: {
        scenarioId: params.scenarioId,
        title: params.title,
        description: params.description,
        deploymentId: params.deploymentId,
        serviceId: params.serviceId,
        versionFrom: params.versionFrom,
        versionTo: params.versionTo,
        deploymentTimestamp: params.deploymentTimestamp,
        metrics: params.metrics as any,
        tags: params.tags || [],
        category: params.category || null,
        severity: params.severity || null,
      },
      update: {
        title: params.title,
        description: params.description,
        deploymentId: params.deploymentId,
        serviceId: params.serviceId,
        versionFrom: params.versionFrom,
        versionTo: params.versionTo,
        deploymentTimestamp: params.deploymentTimestamp,
        metrics: params.metrics as any,
        tags: params.tags || [],
        category: params.category || null,
        severity: params.severity || null,
        updatedAt: new Date(),
      },
    });

    return this.mapToScenario(record);
  }

  /**
   * Map database record to Scenario contract
   * Includes category and severity for evidence generation
   */
  private mapToScenario(record: any): Scenario & { category?: string; severity?: string } {
    return {
      scenarioId: record.scenarioId,
      title: record.title,
      description: record.description,
      deployment: {
        id: record.deploymentId,
        serviceId: record.serviceId,
        versionFrom: record.versionFrom,
        versionTo: record.versionTo,
        timestamp: record.deploymentTimestamp.toISOString(),
      },
      metrics: record.metrics as any[],
      category: record.category || undefined,
      severity: record.severity || undefined,
    };
  }
}
