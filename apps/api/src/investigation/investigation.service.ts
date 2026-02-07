import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { IncidentsPersistenceService } from "../modules/incidents/incidents.persistence.service";
import { GcpMetricsCollector } from "../collectors/gcp-metrics/gcp-metrics.collector";
import { DeploysCollector } from "../collectors/deploys/deploys.collector";
import { ConfigDiffCollector } from "../collectors/configdiff/configdiff.collector";
import { LogsCollector } from "../collectors/logs/logs.collector";
import { TracesCollector } from "../collectors/traces/traces.collector";
import { buildEvidenceBundle } from "../evidence/evidence-bundle.builder";
import { computeEvidenceCompleteness } from "../evidence/completeness";
import { GeminiReasoningAdapter } from "../reasoning/reasoning.adapter";
import { buildReasoningRequest } from "../reasoning/reasoning.request-builder";
import { selectHypothesisCandidates } from "../reasoning/hypotheses/preselector";
import { hashPromptParts, hashRequest, hashResponse } from "../reasoning/trace.hash";
import { planCollectors, type CollectorType } from "./collector-plan";
import type { CurrentUser } from "../auth/auth.types";

const logger = new Logger("InvestigationService");

export interface StartInvestigationParams {
  incidentId: string;
  maxIterations: number;
  confidenceTarget: number;
  user?: CurrentUser;
}

export interface InvestigationIterationResult {
  iteration: number;
  evidenceBundleId: string | null;
  analysisId: string | null;
  completenessScore: number | null;
  overallConfidence: number | null;
  decisionJson: any;
  notes: string | null;
}

@Injectable()
export class InvestigationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly persistence: IncidentsPersistenceService,
    private readonly gcpMetricsCollector: GcpMetricsCollector,
    private readonly deploysCollector: DeploysCollector,
    private readonly configDiffCollector: ConfigDiffCollector,
    private readonly logsCollector: LogsCollector,
    private readonly tracesCollector: TracesCollector,
    private readonly reasoningAdapter: GeminiReasoningAdapter,
  ) {}

  async startInvestigation(params: StartInvestigationParams): Promise<{ sessionId: string; status: string }> {
    const { incidentId, maxIterations, confidenceTarget, user } = params;

    // Verify incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Create session
    const session = await this.prisma.investigationSession.create({
      data: {
        incidentId,
        createdBy: user?.sub ?? null,
        status: "RUNNING",
        maxIterations,
        confidenceTarget,
        currentIteration: 0,
      },
    });

    logger.log(`Started investigation session ${session.id} for incident ${incidentId}`);

    // Run investigation loop asynchronously (don't block the response)
    this.runInvestigationLoop(session.id, incidentId, maxIterations, confidenceTarget, user).catch((error) => {
      logger.error(`Investigation loop failed for session ${session.id}:`, error);
      this.prisma.investigationSession.update({
        where: { id: session.id },
        data: {
          status: "FAILED",
          reason: `Error: ${error?.message || String(error)}`,
        },
      }).catch((updateError) => {
        logger.error(`Failed to update session status:`, updateError);
      });
    });

    return {
      sessionId: session.id,
      status: session.status,
    };
  }

  private async runInvestigationLoop(
    sessionId: string,
    incidentId: string,
    maxIterations: number,
    confidenceTarget: number,
    user?: CurrentUser,
  ): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!incident) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    // Get latest analysis to extract context (window, etc.)
    const latestAnalysis = incident.analyses[0];
    let collectContext: any = null;
    let previousCompletenessScore: number | null = null;

    if (latestAnalysis) {
      const requestJson = latestAnalysis.requestJson as any;
      if (requestJson.evidence?.googleEvidenceLite) {
        const evidenceLite = requestJson.evidence.googleEvidenceLite;
        const windowStart = evidenceLite.timeline.begin
          ? new Date(evidenceLite.timeline.begin)
          : new Date(Date.now() - 30 * 60 * 1000);
        const windowEnd = evidenceLite.timeline.end || evidenceLite.timeline.update
          ? new Date(evidenceLite.timeline.end || evidenceLite.timeline.update!)
          : new Date();
        collectContext = {
          incidentId,
          window: {
            start: windowStart.toISOString(),
            end: windowEnd.toISOString(),
          },
          hints: [
            ...(evidenceLite.service ? [`service:${evidenceLite.service}`] : []),
            ...(evidenceLite.region ? [`region:${evidenceLite.region}`] : []),
            "env:production",
          ],
        };
      } else if (requestJson.scenarioId) {
        // Scenario-based incident - would need scenario service to get deployment time
        // For now, use a default window
        const now = new Date();
        collectContext = {
          incidentId,
          window: {
            start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
            end: now.toISOString(),
          },
          hints: ["env:production"],
        };
      }
    }

    if (!collectContext) {
      // Fallback: use default window
      const now = new Date();
      collectContext = {
        incidentId,
        window: {
          start: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          end: now.toISOString(),
        },
        hints: ["env:production"],
      };
    }

    // Track existing bundle sources across iterations
    let existingSources: string[] = [];

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      logger.log(`Investigation session ${sessionId}, iteration ${iteration}/${maxIterations}`);

      try {
        // Update current iteration
        await this.prisma.investigationSession.update({
          where: { id: sessionId },
          data: { currentIteration: iteration },
        });

        // Get latest completeness to determine what to collect
        let latestBundle = null;
        if (iteration > 1) {
          const lastIteration = await this.prisma.investigationIteration.findFirst({
            where: { sessionId },
            orderBy: { iteration: 'desc' },
          });
          if (lastIteration?.evidenceBundleId) {
            const bundleRecord = await this.prisma.evidenceBundle.findUnique({
              where: { id: lastIteration.evidenceBundleId },
            });
            if (bundleRecord) {
              latestBundle = bundleRecord.payload as any;
              existingSources = bundleRecord.sources;
            }
          }
        } else {
          // First iteration: check if incident has existing bundle
          const existingBundle = await this.prisma.evidenceBundle.findFirst({
            where: { incidentId },
            orderBy: { createdAt: 'desc' },
          });
          if (existingBundle) {
            latestBundle = existingBundle.payload as any;
            existingSources = existingBundle.sources;
          }
        }

        // Compute completeness to determine missing needs
        let completeness = null;
        let missingNeeds: any[] = [];
        if (latestBundle) {
          completeness = computeEvidenceCompleteness({
            incidentSourceType: incident.sourceType,
            primarySignal: "UNKNOWN", // Will be updated after analysis
            bundle: latestBundle,
          });
          missingNeeds = completeness.missing || [];
          previousCompletenessScore = completeness.score;
        }

        // Plan which collectors to run
        const plan = planCollectors(missingNeeds, existingSources);
        logger.log(`Collector plan for iteration ${iteration}: ${plan.reason}`);

        // Collect evidence based on plan
        const collectorArtifacts = [];
        const collectorsToRun: Array<{ type: CollectorType; collector: any }> = [];

        if (plan.collectors.includes("METRICS")) {
          collectorsToRun.push({ type: "METRICS", collector: this.gcpMetricsCollector });
        }
        if (plan.collectors.includes("LOGS")) {
          collectorsToRun.push({ type: "LOGS", collector: this.logsCollector });
        }
        if (plan.collectors.includes("TRACES")) {
          collectorsToRun.push({ type: "TRACES", collector: this.tracesCollector });
        }
        if (plan.collectors.includes("DEPLOYS")) {
          collectorsToRun.push({ type: "DEPLOYS", collector: this.deploysCollector });
        }
        if (plan.collectors.includes("CONFIG")) {
          collectorsToRun.push({ type: "CONFIG", collector: this.configDiffCollector });
        }

        // Run collectors in parallel
        const collectorResults = await Promise.all(
          collectorsToRun.map(({ collector }) => collector.collect(collectContext))
        );

        for (const result of collectorResults) {
          if (result) collectorArtifacts.push(result);
        }

        // If no new collectors were run and no new artifacts, check if we should stop
        if (collectorArtifacts.length === 0 && iteration > 1) {
          logger.log(`No new evidence collected in iteration ${iteration}, stopping`);
          await this.prisma.investigationSession.update({
            where: { id: sessionId },
            data: {
              status: "STOPPED",
              reason: "No new evidence could be collected",
            },
          });
          break;
        }

        // Build or augment evidence bundle
        let bundle;
        if (latestBundle && collectorArtifacts.length === 0) {
          // Reuse existing bundle if no new artifacts
          bundle = latestBundle;
        } else {
          // Build new bundle (will merge with existing if needed)
          const googleEvidenceLite = latestBundle?.googleEvidenceLite || null;
          const scenarioTelemetrySummary = latestBundle?.artifacts?.find((a: any) => a.kind === "telemetry_summary")?.payload || null;

          bundle = buildEvidenceBundle({
            incidentId,
            createdBy: user?.sub ?? null,
            googleEvidenceLite,
            scenarioTelemetrySummary,
            collectorArtifacts,
          });
        }

        // Upsert bundle
        const savedBundle = await this.persistence.upsertEvidenceBundle({
          bundleId: bundle.bundleId,
          incidentId,
          createdBy: user?.sub ?? null,
          sources: bundle.sources,
          payload: bundle,
          hashAlgo: bundle.hashAlgo,
          hashInputVersion: bundle.hashInputVersion,
        });

        // Recompute completeness with new bundle
        completeness = computeEvidenceCompleteness({
          incidentSourceType: incident.sourceType,
          primarySignal: "UNKNOWN", // Will be updated after reasoning
          bundle: savedBundle.payload,
        });

        // Build analysis result (simplified - reuse existing logic pattern)
        const artifacts = bundle.artifacts || [];
        const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
        const sources = bundle.sources || [];

        // Generate basic analysis result
        const analysisResult: any = {
          incidentId,
          summary: `Investigation iteration ${iteration} analysis`,
          likelyRootCauses: [],
          blastRadius: {
            impactedServices: [],
            impactedRoutes: [],
            userImpact: "Unknown",
          },
          questionsToConfirm: [],
          explainability: {
            primarySignal: "UNKNOWN" as const,
            latencyFactor: 1.0,
            errorFactor: 1.0,
            rationale: "Analysis pending reasoning",
          },
          evidenceTable: [],
        };

        // Update completeness with actual primary signal (if available from reasoning)
        let reasoningResponse = null;
        let reasoningResult: any = null;
        let reasoningRequest: any = null;
        try {
          const candidates = selectHypothesisCandidates({
            primarySignal: "UNKNOWN",
            completenessScore: completeness.score,
            has: {
              metrics: artifactKinds.has("metrics_summary") || sources.includes("GCP_METRICS"),
              logs: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
              traces: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
              deploys: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
              config: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
              googleStatus: incident.sourceType === "GOOGLE_CLOUD",
            },
            flags: {
              recentDeploy: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
              configChanged: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
              newErrorSignature: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
              timeouts: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
            },
          });

          reasoningRequest = buildReasoningRequest({
            incidentId,
            evidenceBundleId: savedBundle.bundleId,
            sourceType: incident.sourceType,
            incidentSummary: analysisResult.summary,
            timeline: {
              start: collectContext.window.start,
              end: collectContext.window.end,
            },
            artifacts: bundle.artifacts.map((a: any) => ({
              artifactId: a.artifactId,
              kind: a.kind,
              title: a.title,
              summary: a.summary,
            })),
            candidates,
          });

          reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
          reasoningResponse = reasoningResult.response;

          // Update analysis result with reasoning
          if (reasoningResponse) {
            analysisResult.likelyRootCauses = reasoningResponse.hypotheses.map((h: any) => ({
              rank: h.rank,
              title: h.title,
              confidence: h.confidence,
              evidence: h.evidenceRefs || [],
              nextActions: h.nextActions || [],
            }));
            analysisResult.explainability = {
              primarySignal: reasoningResponse.explainability.primarySignal.toLowerCase(),
              latencyFactor: reasoningResponse.explainability.latencyFactor,
              errorFactor: reasoningResponse.explainability.errorFactor,
              rationale: reasoningResponse.explainability.rationale,
            };

            // Update completeness with actual primary signal
            completeness = computeEvidenceCompleteness({
              incidentSourceType: incident.sourceType,
              primarySignal: reasoningResponse.explainability.primarySignal === "LATENCY" ? "latency" :
                             reasoningResponse.explainability.primarySignal === "ERRORS" ? "errors" : "UNKNOWN",
              bundle: savedBundle.payload,
            });
          }
        } catch (error: any) {
          logger.warn(`Reasoning failed in iteration ${iteration}:`, error?.message || error);
        }

        // Save analysis
        const newAnalysis = await this.persistence.saveAnalysis({
          incidentId,
          requestJson: {
            investigationSessionId: sessionId,
            iteration,
            collectorPlan: plan,
          },
          resultJson: analysisResult,
          evidenceBundleId: savedBundle.id,
          evidenceCompleteness: completeness,
          reasoningJson: reasoningResponse,
        });

        // Save prompt trace (if reasoning succeeded) - now that we have the analysis ID
        if (reasoningResponse && reasoningResult) {
          const promptHash = hashPromptParts(reasoningResult.prompt.system, reasoningResult.prompt.user);
          const requestHash = hashRequest(reasoningRequest);
          const responseHash = hashResponse(reasoningResponse);

          await this.prisma.promptTrace.create({
            data: {
              incidentId,
              analysisId: newAnalysis.id,
              evidenceBundleId: savedBundle.bundleId,
              model: reasoningResponse.model,
              promptVersion: reasoningResponse.promptVersion,
              promptHash,
              requestHash,
              responseHash,
              systemPrompt: reasoningResult.prompt.system,
              userPrompt: reasoningResult.prompt.user,
              requestJson: reasoningRequest as any,
              responseJson: reasoningResponse as any,
            },
          });
        }

        const overallConfidence = reasoningResponse?.overallConfidence ?? null;
        const completenessScore = completeness.score;

        // Record iteration
        const iterationRecord = await this.prisma.investigationIteration.create({
          data: {
            sessionId,
            iteration,
            evidenceBundleId: savedBundle.id,
            analysisId: newAnalysis.id,
            completenessScore,
            overallConfidence,
            decisionJson: {
              collectorPlan: {
                collectors: plan.collectors,
                reason: plan.reason,
              },
              missingNeeds: missingNeeds,
            } as any,
            notes: plan.reason,
          },
        });

        logger.log(
          `Iteration ${iteration} complete: confidence=${overallConfidence}, completeness=${completenessScore}`
        );

        // Check stop conditions
        if (overallConfidence !== null && overallConfidence >= confidenceTarget) {
          logger.log(`Confidence target reached: ${overallConfidence} >= ${confidenceTarget}`);
          await this.prisma.investigationSession.update({
            where: { id: sessionId },
            data: {
              status: "COMPLETED",
              reason: `Confidence target reached: ${overallConfidence.toFixed(2)} >= ${confidenceTarget}`,
            },
          });
          break;
        }

        // Check if completeness improved
        if (previousCompletenessScore !== null && completenessScore <= previousCompletenessScore && collectorArtifacts.length === 0) {
          logger.log(`Completeness did not improve: ${completenessScore} <= ${previousCompletenessScore}`);
          await this.prisma.investigationSession.update({
            where: { id: sessionId },
            data: {
              status: "STOPPED",
              reason: `Completeness did not improve and no new evidence collected`,
            },
          });
          break;
        }

        previousCompletenessScore = completenessScore;
        existingSources = bundle.sources;

      } catch (error: any) {
        logger.error(`Error in iteration ${iteration}:`, error);
        await this.prisma.investigationSession.update({
          where: { id: sessionId },
          data: {
            status: "FAILED",
            reason: `Error in iteration ${iteration}: ${error?.message || String(error)}`,
          },
        });
        throw error;
      }
    }

    // If we exhausted iterations, mark as stopped
    const session = await this.prisma.investigationSession.findUnique({
      where: { id: sessionId },
    });

    if (session && session.status === "RUNNING") {
      await this.prisma.investigationSession.update({
        where: { id: sessionId },
        data: {
          status: "STOPPED",
          reason: `Maximum iterations reached: ${maxIterations}`,
        },
      });
    }
  }

  async getSessionStatus(sessionId: string) {
    const session = await this.prisma.investigationSession.findUnique({
      where: { id: sessionId },
      include: {
        iterations: {
          orderBy: { iteration: 'asc' },
        },
      },
    });

    if (!session) {
      throw new Error(`Investigation session not found: ${sessionId}`);
    }

    return {
      sessionId: session.id,
      incidentId: session.incidentId,
      status: session.status,
      currentIteration: session.currentIteration,
      maxIterations: session.maxIterations,
      confidenceTarget: session.confidenceTarget,
      reason: session.reason,
      iterations: session.iterations.map((iter) => ({
        iteration: iter.iteration,
        createdAt: iter.createdAt.toISOString(),
        evidenceBundleId: iter.evidenceBundleId,
        analysisId: iter.analysisId,
        completenessScore: iter.completenessScore,
        overallConfidence: iter.overallConfidence,
      })),
    };
  }
}
