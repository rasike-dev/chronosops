import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IncidentsPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async createIncident(params: {
    scenarioId: string;
    title?: string | null;
    sourceType?: 'SCENARIO' | 'GOOGLE_CLOUD';
    sourceRef?: string | null;
    sourcePayload?: unknown | null;
  }) {
    return this.prisma.incident.create({
      data: {
        scenarioId: params.scenarioId,
        title: params.title ?? null,
        status: 'analyzed',
        sourceType: params.sourceType ?? 'SCENARIO',
        sourceRef: params.sourceRef ?? null,
        sourcePayload: params.sourcePayload ? (params.sourcePayload as any) : null,
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
    evidenceBundleId?: string | null;
    evidenceCompleteness?: unknown | null;
    reasoningJson?: unknown | null;
  }) {
    return this.prisma.incidentAnalysis.create({
      data: {
        incidentId: params.incidentId,
        requestJson: params.requestJson as any,
        resultJson: params.resultJson as any,
        evidenceBundleId: params.evidenceBundleId ?? null,
        evidenceCompleteness: params.evidenceCompleteness ? (params.evidenceCompleteness as any) : null,
        reasoningJson: params.reasoningJson ? (params.reasoningJson as any) : null,
      },
    });
  }

  /**
   * Upsert evidence bundle (content-addressed, immutable)
   */
  async upsertEvidenceBundle(params: {
    bundleId: string;
    incidentId: string;
    createdBy?: string | null;
    sources: string[];
    payload: unknown;
    hashAlgo: string;
    hashInputVersion: string;
  }) {
    return this.prisma.evidenceBundle.upsert({
      where: { bundleId: params.bundleId },
      create: {
        bundleId: params.bundleId,
        incidentId: params.incidentId,
        createdBy: params.createdBy ?? null,
        sources: params.sources,
        payload: params.payload as any,
        hashAlgo: params.hashAlgo,
        hashInputVersion: params.hashInputVersion,
      },
      update: {}, // Immutable by content - if hash matches, bundle is identical
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
    generatorVersion?: string | null;
  }) {
    return this.prisma.postmortem.create({
      data: {
        incidentId: params.incidentId,
        markdown: params.markdown,
        json: params.json as any,
        generatorVersion: params.generatorVersion ?? null,
      },
    });
  }
}
