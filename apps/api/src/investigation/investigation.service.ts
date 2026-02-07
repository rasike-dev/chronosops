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
import { applyEvidenceRequestPolicy } from "./evidence-request.policy";
import { mapRequestsToCollectors, buildCollectContext } from "./evidence-request.mapper";
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

        // Day 17: First run reasoning on existing bundle to get model requests
        // Then collect evidence based on model requests (if approved) or fallback
        
        // Compute completeness for initial reasoning
        let completeness = null;
        let missingNeeds: any[] = [];
        if (latestBundle) {
          completeness = computeEvidenceCompleteness({
            incidentSourceType: incident.sourceType,
            primarySignal: "UNKNOWN",
            bundle: latestBundle,
          });
          missingNeeds = completeness.missing || [];
          previousCompletenessScore = completeness.score;
        }

        // Build initial bundle reference for reasoning
        let bundle = latestBundle || {
          bundleId: `temp-${incidentId}-${iteration}`,
          artifacts: [],
          sources: [],
        };

        // Run reasoning first to get model requests (Day 17)
        let reasoningResponse = null;
        let reasoningResult: any = null;
        let reasoningRequest: any = null;
        let modelRequests: any[] = [];
        let approvedRequests: any[] = [];
        let rejectedRequests: any[] = [];
        let executedCollectors: string[] = [];
        let useModelRequests = false;

        try {
          const artifacts = bundle.artifacts || [];
          const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
          const sources = bundle.sources || [];

          const candidates = selectHypothesisCandidates({
            primarySignal: "UNKNOWN",
            completenessScore: completeness?.score || 0,
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

          // Use existing bundle ID or create a temporary one
          const bundleIdForReasoning = latestBundle?.bundleId || `temp-${incidentId}-${iteration}`;

          reasoningRequest = buildReasoningRequest({
            incidentId,
            evidenceBundleId: bundleIdForReasoning,
            sourceType: incident.sourceType,
            incidentSummary: `Investigation iteration ${iteration}`,
            timeline: {
              start: collectContext.window.start,
              end: collectContext.window.end,
            },
            artifacts: artifacts.map((a: any) => ({
              artifactId: a.artifactId || a.kind,
              kind: a.kind,
              title: a.title || a.kind,
              summary: a.summary || "",
            })),
            candidates,
          });

          reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
          reasoningResponse = reasoningResult.response;

          // Day 17: Check for model evidence requests
          if (reasoningResponse?.missingEvidenceRequests && reasoningResponse.missingEvidenceRequests.length > 0) {
            modelRequests = reasoningResponse.missingEvidenceRequests;
            logger.log(`Model requested ${modelRequests.length} evidence types`);

            // Apply policy gating
            const policyResult = applyEvidenceRequestPolicy(
              modelRequests,
              {
                start: collectContext.window.start,
                end: collectContext.window.end,
              }
            );

            approvedRequests = policyResult.approvedRequests;
            rejectedRequests = policyResult.rejectedRequests.map(r => ({
              request: r.request,
              reason: r.reason,
            }));

            if (approvedRequests.length > 0) {
              useModelRequests = true;
              logger.log(`Approved ${approvedRequests.length} model requests, rejected ${rejectedRequests.length}`);
            } else {
              logger.warn(`All ${modelRequests.length} model requests were rejected`);
            }
          }
        } catch (error: any) {
          logger.warn(`Reasoning failed in iteration ${iteration}:`, error?.message || error);
        }

        // Day 17: Collect evidence based on model requests (if approved) or fallback to deterministic plan
        const collectorArtifacts = [];
        const fallbackPlan = planCollectors(missingNeeds, existingSources);

        if (useModelRequests && approvedRequests.length > 0) {
          // Use model-directed collection
          const mappings = mapRequestsToCollectors(approvedRequests, {
            metrics: this.gcpMetricsCollector,
            logs: this.logsCollector,
            traces: this.tracesCollector,
            deploys: this.deploysCollector,
            config: this.configDiffCollector,
          });

          // Run collectors with request-specific context
          const collectorResults = await Promise.all(
            mappings.map(({ collector, request }) => {
              const reqContext = buildCollectContext(
                request,
                {
                  start: collectContext.window.start,
                  end: collectContext.window.end,
                },
                incidentId,
                collectContext.hints
              );
              executedCollectors.push(request.need);
              return collector.collect(reqContext);
            })
          );

          for (const result of collectorResults) {
            if (result) collectorArtifacts.push(result);
          }
        } else {
          // Fallback to deterministic plan (Day 16 behavior)
          logger.log(`Using fallback plan: ${fallbackPlan.reason}`);
          const collectorsToRun: Array<{ type: CollectorType; collector: any }> = [];

          if (fallbackPlan.collectors.includes("METRICS")) {
            collectorsToRun.push({ type: "METRICS", collector: this.gcpMetricsCollector });
          }
          if (fallbackPlan.collectors.includes("LOGS")) {
            collectorsToRun.push({ type: "LOGS", collector: this.logsCollector });
          }
          if (fallbackPlan.collectors.includes("TRACES")) {
            collectorsToRun.push({ type: "TRACES", collector: this.tracesCollector });
          }
          if (fallbackPlan.collectors.includes("DEPLOYS")) {
            collectorsToRun.push({ type: "DEPLOYS", collector: this.deploysCollector });
          }
          if (fallbackPlan.collectors.includes("CONFIG")) {
            collectorsToRun.push({ type: "CONFIG", collector: this.configDiffCollector });
          }

          // Run collectors in parallel
          const collectorResults = await Promise.all(
            collectorsToRun.map(({ collector, type }) => {
              executedCollectors.push(type);
              return collector.collect(collectContext);
            })
          );

          for (const result of collectorResults) {
            if (result) collectorArtifacts.push(result);
          }
        }

        // Day 17: Check stop condition - if model requested evidence but all were rejected
        if (useModelRequests && approvedRequests.length === 0 && modelRequests.length > 0) {
          logger.log(`All model evidence requests rejected in iteration ${iteration}, stopping`);
          await this.prisma.investigationSession.update({
            where: { id: sessionId },
            data: {
              status: "STOPPED",
              reason: "NO_APPROVED_EVIDENCE_REQUESTS: All model evidence requests were rejected by policy",
            },
          });
          break;
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
        if (latestBundle && collectorArtifacts.length === 0) {
          // Reuse existing bundle if no new artifacts
          bundle = latestBundle;
        } else {
          // Build new bundle
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
          primarySignal: reasoningResponse?.explainability?.primarySignal === "LATENCY" ? "latency" :
                         reasoningResponse?.explainability?.primarySignal === "ERRORS" ? "errors" : "UNKNOWN",
          bundle: savedBundle.payload,
        });

        // Build analysis result
        const artifacts = bundle.artifacts || [];
        const analysisResult: any = {
          incidentId,
          summary: `Investigation iteration ${iteration} analysis`,
          likelyRootCauses: reasoningResponse?.hypotheses?.map((h: any) => ({
            rank: h.rank,
            title: h.title,
            confidence: h.confidence,
            evidence: h.evidenceRefs || [],
            nextActions: h.nextActions || [],
          })) || [],
          blastRadius: {
            impactedServices: [],
            impactedRoutes: [],
            userImpact: "Unknown",
          },
          questionsToConfirm: [],
          explainability: reasoningResponse?.explainability ? {
            primarySignal: reasoningResponse.explainability.primarySignal.toLowerCase(),
            latencyFactor: reasoningResponse.explainability.latencyFactor,
            errorFactor: reasoningResponse.explainability.errorFactor,
            rationale: reasoningResponse.explainability.rationale,
          } : {
            primarySignal: "UNKNOWN" as const,
            latencyFactor: 1.0,
            errorFactor: 1.0,
            rationale: "Analysis pending reasoning",
          },
          evidenceTable: [],
        };

        // Save analysis
        const newAnalysis = await this.persistence.saveAnalysis({
          incidentId,
          requestJson: {
            investigationSessionId: sessionId,
            iteration,
            useModelRequests,
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

        // Record iteration with Day 17 audit trail
        const decisionJson: any = {
          useModelRequests,
          modelRequests: modelRequests,
          approvedRequests: approvedRequests,
          rejectedRequests: rejectedRequests,
          executedCollectors: executedCollectors,
        };

        if (!useModelRequests) {
          // Include fallback plan info
          decisionJson.fallbackPlan = {
            collectors: fallbackPlan.collectors,
            reason: fallbackPlan.reason,
          };
          decisionJson.missingNeeds = missingNeeds;
        }

        const iterationRecord = await this.prisma.investigationIteration.create({
          data: {
            sessionId,
            iteration,
            evidenceBundleId: savedBundle.id,
            analysisId: newAnalysis.id,
            completenessScore,
            overallConfidence,
            decisionJson: decisionJson as any,
            notes: useModelRequests
              ? `Model-directed: ${approvedRequests.length} approved, ${rejectedRequests.length} rejected`
              : fallbackPlan.reason,
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
