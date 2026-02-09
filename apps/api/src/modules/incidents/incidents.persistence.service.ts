import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class IncidentsPersistenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createIncident(params: {
    scenarioId?: string; // Optional for non-scenario incidents
    title?: string | null;
    sourceType?: 'SCENARIO' | 'GOOGLE_CLOUD' | 'PAGERDUTY' | 'DATADOG' | 'NEW_RELIC' | 'CUSTOM';
    sourceRef?: string | null;
    sourcePayload?: unknown | null;
  }) {
    // For non-scenario incidents, use sourceRef as scenarioId (required by schema)
    // This is a temporary workaround - ideally scenarioId should be optional
    const scenarioId = params.scenarioId || params.sourceRef || 'unknown';
    
    return this.prisma.incident.create({
      data: {
        scenarioId,
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
    const result = await this.prisma.incidentAnalysis.create({
      data: {
        incidentId: params.incidentId,
        requestJson: params.requestJson as any,
        resultJson: params.resultJson as any,
        evidenceBundleId: params.evidenceBundleId ?? null,
        evidenceCompleteness: params.evidenceCompleteness ? (params.evidenceCompleteness as any) : null,
        reasoningJson: params.reasoningJson ? (params.reasoningJson as any) : null,
      },
    });

    // Day 20: Emit audit event for analysis creation
    const completeness = params.evidenceCompleteness as any;
    const reasoning = params.reasoningJson as any;
    
    await this.audit.appendEvent({
      eventType: "ANALYSIS_CREATED",
      entityType: "INCIDENT_ANALYSIS",
      entityId: result.id,
      entityRef: null,
      payload: {
        analysisId: result.id,
        incidentId: params.incidentId,
        evidenceBundleId: params.evidenceBundleId,
        completenessScore: completeness?.score ?? null,
        overallConfidence: reasoning?.overallConfidence ?? null,
      },
    });

    return result;
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
    const result = await this.prisma.evidenceBundle.upsert({
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

    // Day 20: Emit audit event for bundle creation (only if newly created)
    const wasCreated = result.createdAt.getTime() === new Date().getTime() || 
                       Math.abs(result.createdAt.getTime() - Date.now()) < 5000; // Within 5 seconds
    if (wasCreated) {
      const artifacts = (params.payload as any)?.artifacts || [];
      const artifactIds = artifacts.map((a: any) => a.artifactId || a.kind).filter(Boolean);
      
      await this.audit.appendEvent({
        eventType: "EVIDENCE_BUNDLE_CREATED",
        entityType: "EVIDENCE_BUNDLE",
        entityId: result.id,
        entityRef: params.bundleId,
        payload: {
          bundleId: params.bundleId,
          incidentId: params.incidentId,
          sources: params.sources,
          artifactIds: artifactIds.slice(0, 50), // Bounded
          hashAlgo: params.hashAlgo,
          hashInputVersion: params.hashInputVersion,
        },
      });
    }

    return result;
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
    const result = await this.prisma.postmortem.create({
      data: {
        incidentId: params.incidentId,
        markdown: params.markdown,
        json: params.json as any,
        generatorVersion: params.generatorVersion ?? null,
      },
    });

    // Day 20: Emit audit event for postmortem creation
    const json = params.json as any;
    const analysisId = json?.analysisId || null;
    const summary = json?.summary || {};
    const evidence = json?.evidence || {};
    
    await this.audit.appendEvent({
      eventType: "POSTMORTEM_CREATED",
      entityType: "POSTMORTEM",
      entityId: result.id,
      entityRef: null,
      payload: {
        postmortemId: result.id,
        analysisId,
        generatorVersion: params.generatorVersion,
        summaryHeadline: summary.headline || null,
        bundleId: evidence.bundleId || null,
      },
    });

    return result;
  }
}
