import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidentsPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createIncident(params: {
    scenarioId: string;
    title?: string | null;
  }) {
    return this.prisma.incident.create({
      data: {
        scenarioId: params.scenarioId,
        title: params.title ?? null,
        status: 'analyzed',
      },
    });
  }

  /**
   * Save a new analysis row. Always inserts - never overwrites.
   * This preserves audit trail and allows replayability.
   */
  async saveAnalysis(params: {
    incidentId: string;
    requestJson: unknown;
    resultJson: unknown;
  }) {
    return this.prisma.incidentAnalysis.create({
      data: {
        incidentId: params.incidentId,
        requestJson: params.requestJson as any,
        resultJson: params.resultJson as any,
      },
    });
  }

  /**
   * Save a new postmortem snapshot. Always inserts - never overwrites.
   * This preserves full history for audit trail (recommended approach).
   */
  async savePostmortem(params: {
    incidentId: string;
    markdown: string;
    json: unknown;
  }) {
    return this.prisma.postmortem.create({
      data: {
        incidentId: params.incidentId,
        markdown: params.markdown,
        json: params.json as any,
      },
    });
  }
}
