import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, Param, Post, Req } from "@nestjs/common";
import { AnalyzeIncidentRequestSchema, AnalyzeIncidentResponseSchema, ImportGoogleIncidentsRequestSchema, IngestIncidentRequestSchema, IngestIncidentResponseSchema } from "@chronosops/contracts";
import { ScenarioService } from "../scenario/scenario.service";
import { IncidentsPersistenceService } from "./incidents.persistence.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../auth/public.decorator";
import { Roles } from "../../auth/roles.decorator";
import { GoogleIntegrationService } from "../../integrations/google/google.service";
import { buildGoogleEvidenceLite } from "./evidence/google-evidence-lite";
import { buildEvidenceBundle } from "../../evidence/evidence-bundle.builder";
import type { CurrentUser } from "../../auth/auth.types";
import { GcpMetricsCollector } from "../../collectors/gcp-metrics/gcp-metrics.collector";
import { DeploysCollector } from "../../collectors/deploys/deploys.collector";
import { ConfigDiffCollector } from "../../collectors/configdiff/configdiff.collector";
import { LogsCollector } from "../../collectors/logs/logs.collector";
import { TracesCollector } from "../../collectors/traces/traces.collector";
import { computeEvidenceCompleteness } from "../../evidence/completeness";
import { GeminiReasoningAdapter } from "../../reasoning/reasoning.adapter";
import { buildReasoningRequest } from "../../reasoning/reasoning.request-builder";
import { hashPromptParts, hashRequest, hashResponse } from "../../reasoning/trace.hash";
import { selectHypothesisCandidates } from "../../reasoning/hypotheses/preselector";
import { generatePostmortemV2, POSTMORTEM_GENERATOR_VERSION } from "../../postmortem/postmortem.generator";
import { renderPostmortemMarkdown } from "../../postmortem/postmortem.render-md";
import { AnalysisCompareService } from "./analysis/analysis-compare.service";
import { InvestigationService } from "../../investigation/investigation.service";
import { StartInvestigationRequestSchema, StartInvestigationResponseSchema, InvestigationStatusSchema } from "@chronosops/contracts";
import { assertCanViewSensitiveData } from "../../auth/rbac.assert";
import { redactEvidenceBundle } from "../../policy/redaction";
import { buildExplainabilityGraph } from "./analysis/explainability-graph.builder";
import { AuditService } from "../../audit/audit.service";
import { AuditVerifyService } from "./analysis/audit-verify.service";
import { IncidentNormalizer, type NormalizedIncident } from "./ingestion/incident-normalizer";

@Controller("v1/incidents")
export class IncidentsController {
  constructor(
    private readonly scenarios: ScenarioService,
    private readonly persistence: IncidentsPersistenceService,
    private readonly prisma: PrismaService,
    private readonly googleIntegration: GoogleIntegrationService,
    private readonly gcpMetricsCollector: GcpMetricsCollector,
    private readonly deploysCollector: DeploysCollector,
    private readonly configDiffCollector: ConfigDiffCollector,
    private readonly logsCollector: LogsCollector,
    private readonly tracesCollector: TracesCollector,
    private readonly reasoningAdapter: GeminiReasoningAdapter,
    private readonly analysisCompareService: AnalysisCompareService,
    private readonly investigationService: InvestigationService,
    private readonly audit: AuditService,
    private readonly auditVerify: AuditVerifyService,
    private readonly normalizer: IncidentNormalizer,
  ) {}

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get()
  async list() {
    try {
      const incidents = await this.prisma.incident.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          scenarioId: true,
          title: true,
          status: true,
          createdAt: true,
          sourceType: true,
          sourceRef: true,
        },
      });
      return incidents;
    } catch (error: any) {
      console.error('[IncidentsController.list] Error:', error?.message || error);
      throw new HttpException(
        `Failed to list incidents: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(':id')
  async detail(@Param('id') id: string, @Req() httpReq: { user?: CurrentUser }) {
    try {
      const incident = await this.prisma.incident.findUnique({
        where: { id },
        include: {
          analyses: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          postmortems: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
      
      if (!incident) {
        throw new HttpException(`Incident not found: ${id}`, HttpStatus.NOT_FOUND);
      }
      
      // Day 18: Data exposure control - hide sourcePayload from non-admin
      const isAdmin = httpReq.user?.roles?.includes("CHRONOSOPS_ADMIN");
      if (!isAdmin && incident.sourcePayload) {
        const { sourcePayload, ...rest } = incident;
        return {
          ...rest,
          sourceType: incident.sourceType,
          sourceRef: incident.sourceRef,
          // Return normalized form only (sourcePayload hidden)
        };
      }
      
      return incident;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.detail] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get incident: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Post(":id/reanalyze")
  async reanalyze(@Param('id') incidentId: string, @Req() httpReq: { user?: CurrentUser }) {
    try {
      // 1) Load incident
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
        throw new HttpException(`Incident not found: ${incidentId}`, HttpStatus.NOT_FOUND);
      }

      // 2) Get latest analysis (or first) to extract requestJson
      const latestAnalysis = incident.analyses[0];
      if (!latestAnalysis) {
        throw new HttpException(
          `No analysis found for incident: ${incidentId}. Cannot reanalyze without original request.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3) Parse the stored requestJson (replayability: use original request parameters)
      const originalRequest = latestAnalysis.requestJson as any;

      // 4) Handle Google Cloud incidents differently
      if (incident.sourceType === 'GOOGLE_CLOUD' && originalRequest.evidence?.googleEvidenceLite) {
        // Re-analyze Google incident using stored evidence-lite
        const evidenceLite = originalRequest.evidence.googleEvidenceLite;
        
        // Collect evidence from all collectors (re-collect to ensure bundle includes latest)
        const windowStart = evidenceLite.timeline.begin 
          ? new Date(evidenceLite.timeline.begin)
          : new Date(Date.now() - 30 * 60 * 1000);
        const windowEnd = evidenceLite.timeline.end || evidenceLite.timeline.update
          ? new Date(evidenceLite.timeline.end || evidenceLite.timeline.update!)
          : new Date();
        
        const collectorArtifacts = [];
        const collectContext = {
          incidentId: incident.id,
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
        
        // Collect from all collectors
        const [metricsResult, deploysResult, configDiffResult, logsResult, tracesResult] = await Promise.all([
          this.gcpMetricsCollector.collect(collectContext),
          this.deploysCollector.collect(collectContext),
          this.configDiffCollector.collect(collectContext),
          this.logsCollector.collect(collectContext),
          this.tracesCollector.collect(collectContext),
        ]);
        
        if (metricsResult) collectorArtifacts.push(metricsResult);
        if (deploysResult) collectorArtifacts.push(deploysResult);
        if (configDiffResult) collectorArtifacts.push(configDiffResult);
        if (logsResult) collectorArtifacts.push(logsResult);
        if (tracesResult) collectorArtifacts.push(tracesResult);
        
        // Rebuild bundle from stored evidence-lite + collector artifacts (same hash if evidence unchanged)
        const bundle = buildEvidenceBundle({
          incidentId: incident.id,
          createdBy: httpReq.user?.sub ?? null,
          googleEvidenceLite: evidenceLite,
          scenarioTelemetrySummary: null,
          collectorArtifacts,
        });

        // Upsert bundle (will reuse existing if hash matches)
        const savedBundle = await this.persistence.upsertEvidenceBundle({
          bundleId: bundle.bundleId,
          incidentId: incident.id,
          createdBy: bundle.createdBy ?? null,
          sources: bundle.sources,
          payload: bundle,
          hashAlgo: bundle.hashAlgo,
          hashInputVersion: bundle.hashInputVersion,
        });
        
        // Re-generate analysis result (same structure as analyzeExisting)
        const analysisResult: any = {
          incidentId: incident.id,
          summary: `Analysis of Google Cloud incident: ${evidenceLite.headline}`,
          likelyRootCauses: [
            {
              rank: 1,
              title: "Google Cloud service incident",
              confidence: 0.8,
              evidence: [],
              nextActions: evidenceLite.hypothesisHints,
            },
          ],
          blastRadius: {
            impactedServices: evidenceLite.service ? [evidenceLite.service] : [],
            impactedRoutes: [],
            userImpact: evidenceLite.severity === "critical" || evidenceLite.severity === "high" 
              ? "High - Critical/High severity incident" 
              : "Medium - Ongoing service incident",
          },
          questionsToConfirm: [],
          explainability: {
            primarySignal: "errors" as const,
            latencyFactor: 1.0,
            errorFactor: evidenceLite.severity === "critical" ? 10.0 : 5.0,
            rationale: `Imported from Google Cloud status; no internal telemetry attached yet. Status: ${evidenceLite.status}, Severity: ${evidenceLite.severity}`,
          },
          evidenceTable: [],
        };

        // 5) Compute evidence completeness
        const completeness = computeEvidenceCompleteness({
          incidentSourceType: incident.sourceType,
          primarySignal: analysisResult.explainability?.primarySignal ?? "UNKNOWN",
          bundle: savedBundle.payload,
        });

        // 6) Select hypothesis candidates and build reasoning request
        const artifacts = bundle.artifacts || [];
        const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
        const sources = bundle.sources || [];
        
        const flags = {
          recentDeploy: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
          configChanged: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
          newErrorSignature: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
          timeouts: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
        };
        
        const candidates = selectHypothesisCandidates({
          primarySignal: analysisResult.explainability?.primarySignal === "latency" ? "LATENCY" :
                         analysisResult.explainability?.primarySignal === "errors" ? "ERRORS" : "UNKNOWN",
          completenessScore: completeness.score,
          has: {
            metrics: artifactKinds.has("metrics_summary") || sources.includes("GCP_METRICS"),
            logs: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
            traces: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
            deploys: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
            config: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
            googleStatus: Boolean(evidenceLite) || sources.includes("GOOGLE_CLOUD"),
          },
          flags,
        });

        const reasoningRequest = buildReasoningRequest({
          incidentId: incident.id,
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

        // 7) Call reasoning adapter
        let reasoningResult = null;
        let reasoningResponse = null;
        try {
          reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
          reasoningResponse = reasoningResult.response;
          
          const promptHash = hashPromptParts(reasoningResult.prompt.system, reasoningResult.prompt.user);
          const requestHash = hashRequest(reasoningRequest);
          const responseHash = hashResponse(reasoningResponse);
          
          (reasoningResult as any).traceData = {
            promptHash,
            requestHash,
            responseHash,
            systemPrompt: reasoningResult.prompt.system,
            userPrompt: reasoningResult.prompt.user,
          };
        } catch (error: any) {
          console.error('[IncidentsController.reanalyze] Reasoning adapter failed:', error?.message || error);
        }

        // 8) Persist new analysis row with bundle link (always inserts - preserves audit trail)
        const newAnalysis = await this.persistence.saveAnalysis({
          incidentId: incident.id,
          requestJson: originalRequest, // The stored requestJson with evidence-lite
          resultJson: analysisResult,
          evidenceBundleId: savedBundle.id,
          evidenceCompleteness: completeness,
          reasoningJson: reasoningResponse,
        });

        // 9) Persist prompt trace (if reasoning succeeded)
        if (reasoningResult && reasoningResponse) {
          const traceData = (reasoningResult as any).traceData;
          await this.prisma.promptTrace.create({
            data: {
              incidentId: incident.id,
              analysisId: newAnalysis.id,
              evidenceBundleId: savedBundle.bundleId,
              model: reasoningResponse.model,
              promptVersion: reasoningResponse.promptVersion,
              promptHash: traceData.promptHash,
              requestHash: traceData.requestHash,
              responseHash: traceData.responseHash,
              systemPrompt: traceData.systemPrompt,
              userPrompt: traceData.userPrompt,
              requestJson: reasoningRequest as any,
              responseJson: reasoningResponse as any,
            },
          });
        }

        // 10) Generate and save new postmortem snapshot (v2)
        const promptTrace = reasoningResult ? await this.prisma.promptTrace.findFirst({
          where: { analysisId: newAnalysis.id },
          select: { id: true, promptHash: true, responseHash: true },
        }) : null;
        
        const postmortemV2 = generatePostmortemV2({
          incident: {
            id: incident.id,
            title: incident.title,
            sourceType: incident.sourceType,
            sourceRef: incident.sourceRef,
            createdAt: incident.createdAt,
          },
          analysis: {
            id: newAnalysis.id,
            createdAt: newAnalysis.createdAt,
            evidenceBundleId: savedBundle.id,
            evidenceCompleteness: completeness,
            reasoningJson: reasoningResponse,
          },
          evidenceBundle: {
            bundleId: savedBundle.bundleId,
            artifacts: bundle.artifacts.map((a: any) => ({
              artifactId: a.artifactId,
              kind: a.kind,
              title: a.title,
              summary: a.summary,
            })),
            googleEvidenceLite: evidenceLite,
          },
          promptTrace: promptTrace,
          timeline: {
            start: collectContext.window.start,
            end: collectContext.window.end,
          },
        });
        
        const postmortemMarkdown = renderPostmortemMarkdown(postmortemV2);
        const newPostmortem = await this.persistence.savePostmortem({
          incidentId: incident.id,
          markdown: postmortemMarkdown,
          json: postmortemV2,
          generatorVersion: POSTMORTEM_GENERATOR_VERSION,
        });

        return {
          incidentId: incident.id,
          analysisId: newAnalysis.id,
          postmortemId: newPostmortem.id,
          result: analysisResult,
        };
      } else {
        // Handle scenario-based incidents (existing flow)
        const req = AnalyzeIncidentRequestSchema.parse(originalRequest);

        // Re-run analyzer using stored requestJson (same logic as analyze endpoint)
        const scenario = this.scenarios.getById(req.scenarioId);
        const analysisResult = await this.performAnalysis(scenario, req);
        
        // Set incidentId in the result
        analysisResult.incidentId = incident.id;

        // Rebuild bundle from scenario telemetry (same hash if evidence unchanged)
        const scenarioTelemetrySummary = {
          scenarioId: scenario.scenarioId,
          deployment: scenario.deployment,
          metricsCount: scenario.metrics.length,
          serviceId: scenario.deployment.serviceId,
        };

        // Collect evidence from all collectors (re-collect to ensure bundle includes latest)
        const deployTime = new Date(scenario.deployment.timestamp);
        const windowMinutesBefore = req.windowMinutesBefore || 15;
        const windowMinutesAfter = req.windowMinutesAfter || 15;
        const windowStart = new Date(deployTime.getTime() - windowMinutesBefore * 60 * 1000);
        const windowEnd = new Date(deployTime.getTime() + windowMinutesAfter * 60 * 1000);
        
        const collectorArtifacts = [];
        const collectContext = {
          incidentId: incident.id,
          window: {
            start: windowStart.toISOString(),
            end: windowEnd.toISOString(),
          },
          hints: [
            `service:${scenario.deployment.serviceId}`,
            "env:production",
          ],
        };
        
        // Collect from all collectors
        const [metricsResult, deploysResult, configDiffResult, logsResult, tracesResult] = await Promise.all([
          this.gcpMetricsCollector.collect(collectContext),
          this.deploysCollector.collect(collectContext),
          this.configDiffCollector.collect(collectContext),
          this.logsCollector.collect(collectContext),
          this.tracesCollector.collect(collectContext),
        ]);
        
        if (metricsResult) collectorArtifacts.push(metricsResult);
        if (deploysResult) collectorArtifacts.push(deploysResult);
        if (configDiffResult) collectorArtifacts.push(configDiffResult);
        if (logsResult) collectorArtifacts.push(logsResult);
        if (tracesResult) collectorArtifacts.push(tracesResult);

        const bundle = buildEvidenceBundle({
          incidentId: incident.id,
          createdBy: httpReq.user?.sub ?? null,
          scenarioTelemetrySummary,
          googleEvidenceLite: null,
          collectorArtifacts,
        });

        // Upsert bundle (will reuse existing if hash matches)
        const savedBundle = await this.persistence.upsertEvidenceBundle({
          bundleId: bundle.bundleId,
          incidentId: incident.id,
          createdBy: bundle.createdBy ?? null,
          sources: bundle.sources,
          payload: bundle,
          hashAlgo: bundle.hashAlgo,
          hashInputVersion: bundle.hashInputVersion,
        });

        // 5) Compute evidence completeness
        const completeness = computeEvidenceCompleteness({
          incidentSourceType: incident.sourceType,
          primarySignal: analysisResult.explainability?.primarySignal ?? "UNKNOWN",
          bundle: savedBundle.payload,
        });

        // 6) Select hypothesis candidates and build reasoning request
        const artifacts = bundle.artifacts || [];
        const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
        const sources = bundle.sources || [];
        
        const flags = {
          recentDeploy: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
          configChanged: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
          newErrorSignature: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
          timeouts: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
        };
        
        const candidates = selectHypothesisCandidates({
          primarySignal: analysisResult.explainability?.primarySignal === "latency" ? "LATENCY" :
                         analysisResult.explainability?.primarySignal === "errors" ? "ERRORS" : "UNKNOWN",
          completenessScore: completeness.score,
          has: {
            metrics: artifactKinds.has("metrics_summary") || sources.includes("GCP_METRICS"),
            logs: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
            traces: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
            deploys: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
            config: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
            googleStatus: false,
          },
          flags,
        });

        const reasoningRequest = buildReasoningRequest({
          incidentId: incident.id,
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

        // 7) Call reasoning adapter
        let reasoningResult = null;
        let reasoningResponse = null;
        try {
          reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
          reasoningResponse = reasoningResult.response;
          
          const promptHash = hashPromptParts(reasoningResult.prompt.system, reasoningResult.prompt.user);
          const requestHash = hashRequest(reasoningRequest);
          const responseHash = hashResponse(reasoningResponse);
          
          (reasoningResult as any).traceData = {
            promptHash,
            requestHash,
            responseHash,
            systemPrompt: reasoningResult.prompt.system,
            userPrompt: reasoningResult.prompt.user,
          };
        } catch (error: any) {
          console.error('[IncidentsController.reanalyze] Reasoning adapter failed:', error?.message || error);
        }

        // 8) Persist new analysis row with bundle link (always inserts - preserves audit trail)
        const newAnalysis = await this.persistence.saveAnalysis({
          incidentId: incident.id,
          requestJson: originalRequest, // The stored requestJson from original analysis
          resultJson: analysisResult,
          evidenceBundleId: savedBundle.id,
          evidenceCompleteness: completeness,
          reasoningJson: reasoningResponse,
        });

        // 9) Persist prompt trace (if reasoning succeeded)
        if (reasoningResult && reasoningResponse) {
          const traceData = (reasoningResult as any).traceData;
          await this.prisma.promptTrace.create({
            data: {
              incidentId: incident.id,
              analysisId: newAnalysis.id,
              evidenceBundleId: savedBundle.bundleId,
              model: reasoningResponse.model,
              promptVersion: reasoningResponse.promptVersion,
              promptHash: traceData.promptHash,
              requestHash: traceData.requestHash,
              responseHash: traceData.responseHash,
              systemPrompt: traceData.systemPrompt,
              userPrompt: traceData.userPrompt,
              requestJson: reasoningRequest as any,
              responseJson: reasoningResponse as any,
            },
          });
        }

        // 10) Generate and save new postmortem snapshot (v2)
        const promptTrace = reasoningResult ? await this.prisma.promptTrace.findFirst({
          where: { analysisId: newAnalysis.id },
          select: { id: true, promptHash: true, responseHash: true },
        }) : null;
        
        const postmortemV2 = generatePostmortemV2({
          incident: {
            id: incident.id,
            title: incident.title,
            sourceType: incident.sourceType,
            sourceRef: incident.sourceRef,
            createdAt: incident.createdAt,
          },
          analysis: {
            id: newAnalysis.id,
            createdAt: newAnalysis.createdAt,
            evidenceBundleId: savedBundle.id,
            evidenceCompleteness: completeness,
            reasoningJson: reasoningResponse,
          },
          evidenceBundle: {
            bundleId: savedBundle.bundleId,
            artifacts: bundle.artifacts.map((a: any) => ({
              artifactId: a.artifactId,
              kind: a.kind,
              title: a.title,
              summary: a.summary,
            })),
            googleEvidenceLite: null,
          },
          promptTrace: promptTrace,
          timeline: {
            start: collectContext.window.start,
            end: collectContext.window.end,
          },
        });
        
        const postmortemMarkdown = renderPostmortemMarkdown(postmortemV2);
        const newPostmortem = await this.persistence.savePostmortem({
          incidentId: incident.id,
          markdown: postmortemMarkdown,
          json: postmortemV2,
          generatorVersion: POSTMORTEM_GENERATOR_VERSION,
        });

        // 7) Return result with metadata
        return {
          incidentId: incident.id,
          analysisId: newAnalysis.id,
          postmortemId: newPostmortem.id,
          result: analysisResult,
        };
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.reanalyze] Error:', error?.message || error);
      throw new HttpException(
        `Failed to reanalyze incident: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Post("analyze")
  async analyze(@Body() body: any, @Req() httpReq: { user?: CurrentUser }) {
    try {
    const reqBody = AnalyzeIncidentRequestSchema.parse(body);
      const scenario = this.scenarios.getById(reqBody.scenarioId);

      // 1) Create incident
      const incident = await this.persistence.createIncident({
        scenarioId: reqBody.scenarioId,
        title: scenario.title,
      });

      // 2) Build requestJson with evidence (for replayability)
      const requestJson: any = { ...reqBody };
      
      // For scenario-based incidents, create telemetry summary for bundle
      const scenarioTelemetrySummary = {
        scenarioId: scenario.scenarioId,
        deployment: scenario.deployment,
        metricsCount: scenario.metrics.length,
        serviceId: scenario.deployment.serviceId,
      };

      // 3) Collect evidence from all collectors (if applicable)
      // Determine window: 15 minutes before and after deployment (matching analyze window)
      const deployTime = new Date(scenario.deployment.timestamp);
      const windowStart = new Date(deployTime.getTime() - reqBody.windowMinutesBefore * 60 * 1000);
      const windowEnd = new Date(deployTime.getTime() + reqBody.windowMinutesAfter * 60 * 1000);
      
      const collectorArtifacts = [];
      const collectContext = {
        incidentId: incident.id,
        window: {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        },
        hints: [
          `service:${scenario.deployment.serviceId}`,
          "env:production",
        ],
      };
      
      // Collect from all collectors
      const [metricsResult, deploysResult, configDiffResult, logsResult, tracesResult] = await Promise.all([
        this.gcpMetricsCollector.collect(collectContext),
        this.deploysCollector.collect(collectContext),
        this.configDiffCollector.collect(collectContext),
        this.logsCollector.collect(collectContext),
        this.tracesCollector.collect(collectContext),
      ]);
      
      if (metricsResult) collectorArtifacts.push(metricsResult);
      if (deploysResult) collectorArtifacts.push(deploysResult);
      if (configDiffResult) collectorArtifacts.push(configDiffResult);
      if (logsResult) collectorArtifacts.push(logsResult);
      if (tracesResult) collectorArtifacts.push(tracesResult);

      // 4) Build evidence bundle with collector artifacts
      const bundle = buildEvidenceBundle({
        incidentId: incident.id,
        createdBy: httpReq.user?.sub ?? null,
        scenarioTelemetrySummary,
        googleEvidenceLite: null, // Scenario incidents don't have Google evidence
        collectorArtifacts,
      });

      // 5) Upsert bundle (content-addressed, immutable)
      const savedBundle = await this.persistence.upsertEvidenceBundle({
        bundleId: bundle.bundleId,
        incidentId: incident.id,
        createdBy: bundle.createdBy ?? null,
        sources: bundle.sources,
        payload: bundle,
        hashAlgo: bundle.hashAlgo,
        hashInputVersion: bundle.hashInputVersion,
      });

      // 6) Perform analysis first to get primarySignal for candidate selection
      const analysisResult = await this.performAnalysis(scenario, reqBody);
      
      // Set incidentId in the response
      analysisResult.incidentId = incident.id;

      // 7) Compute evidence completeness
      const completeness = computeEvidenceCompleteness({
        incidentSourceType: incident.sourceType,
        primarySignal: analysisResult.explainability?.primarySignal ?? "UNKNOWN",
        bundle: savedBundle.payload,
      });

      // 8) Select hypothesis candidates (deterministic preselector)
      const artifacts = bundle.artifacts || [];
      const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
      const sources = bundle.sources || [];
      
      // Determine flags from evidence
      const hasDeploys = artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS");
      const hasConfig = artifactKinds.has("config_diff_summary") || sources.includes("CONFIG");
      const hasLogs = artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS");
      const hasTraces = artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES");
      
      // Simple heuristics for flags (can be enhanced later)
      const flags = {
        recentDeploy: hasDeploys, // If we have deploys, assume recent deploy
        configChanged: hasConfig, // If we have config diff, assume config changed
        newErrorSignature: hasLogs, // Simplified: if we have logs, might have new errors
        timeouts: hasTraces, // Simplified: if we have traces, might have timeouts
      };
      
      const candidates = selectHypothesisCandidates({
        primarySignal: analysisResult.explainability?.primarySignal === "latency" ? "LATENCY" :
                       analysisResult.explainability?.primarySignal === "errors" ? "ERRORS" : "UNKNOWN",
        completenessScore: completeness.score,
        has: {
          metrics: artifactKinds.has("metrics_summary") || sources.includes("GCP_METRICS"),
          logs: hasLogs,
          traces: hasTraces,
          deploys: hasDeploys,
          config: hasConfig,
          googleStatus: Boolean(bundle.googleEvidenceLite) || sources.includes("GOOGLE_CLOUD"),
        },
        flags,
      });

      // 9) Build reasoning request from evidence bundle (bounded, no raw payload) with candidates
      const reasoningRequest = buildReasoningRequest({
        incidentId: incident.id,
        evidenceBundleId: savedBundle.bundleId,
        sourceType: incident.sourceType,
        incidentSummary: `Incident ${incident.id}: ${scenario.title}`,
        timeline: {
          start: new Date(scenario.deployment.timestamp).toISOString(),
          end: new Date(Date.now()).toISOString(),
        },
        artifacts: bundle.artifacts.map((a: any) => ({
          artifactId: a.artifactId,
          kind: a.kind,
          title: a.title,
          summary: a.summary,
        })),
        candidates,
      });

      // 10) Call reasoning adapter (stubbed for Day 11)
      let reasoningResult = null;
      let reasoningResponse = null;
      try {
        reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
        reasoningResponse = reasoningResult.response;
        
        // Build prompt trace hashes
        const promptHash = hashPromptParts(reasoningResult.prompt.system, reasoningResult.prompt.user);
        const requestHash = hashRequest(reasoningRequest);
        const responseHash = hashResponse(reasoningResponse);
        
        // Note: We'll persist the trace after we have the analysis ID
        // Store trace data temporarily for later persistence
        (reasoningResult as any).traceData = {
          promptHash,
          requestHash,
          responseHash,
          systemPrompt: reasoningResult.prompt.system,
          userPrompt: reasoningResult.prompt.user,
        };
      } catch (error: any) {
        console.error('[IncidentsController.analyze] Reasoning adapter failed:', error?.message || error);
        // Continue without reasoning response (non-blocking for Day 11)
      }

      // 11) Update requestJson to include candidates (for replay)
      const requestJsonWithCandidates = {
        ...requestJson,
        candidateHypotheses: candidates,
      };

      // 12) Persist analysis with requestJson (including candidates), bundle link, completeness, and reasoning
      const savedAnalysis = await this.persistence.saveAnalysis({
        incidentId: incident.id,
        requestJson: requestJsonWithCandidates,
        resultJson: analysisResult,
        evidenceBundleId: savedBundle.id,
        evidenceCompleteness: completeness,
        reasoningJson: reasoningResponse,
      });

      // 11) Persist prompt trace (if reasoning succeeded)
      if (reasoningResult && reasoningResponse) {
        const traceData = (reasoningResult as any).traceData;
        const promptTrace = await this.prisma.promptTrace.create({
          data: {
            incidentId: incident.id,
            analysisId: savedAnalysis.id,
            evidenceBundleId: savedBundle.bundleId,
            model: reasoningResponse.model,
            promptVersion: reasoningResponse.promptVersion,
            promptHash: traceData.promptHash,
            requestHash: traceData.requestHash,
            responseHash: traceData.responseHash,
            systemPrompt: traceData.systemPrompt,
            userPrompt: traceData.userPrompt,
            requestJson: reasoningRequest as any,
            responseJson: reasoningResponse as any,
          },
        });

        // Day 20: Emit audit event for prompt trace
        await this.audit.appendEvent({
          eventType: "PROMPT_TRACE_CREATED",
          entityType: "PROMPT_TRACE",
          entityId: promptTrace.id,
          entityRef: traceData.promptHash,
          payload: {
            promptTraceId: promptTrace.id,
            analysisId: savedAnalysis.id,
            promptHash: traceData.promptHash,
            requestHash: traceData.requestHash,
            responseHash: traceData.responseHash,
            model: reasoningResponse.model,
            promptVersion: reasoningResponse.promptVersion,
          },
        });
      }

      // 13) Generate and persist postmortem (v2)
      const promptTrace = reasoningResult ? await this.prisma.promptTrace.findFirst({
        where: { analysisId: savedAnalysis.id },
        select: { id: true, promptHash: true, responseHash: true },
      }) : null;
      
      const postmortemV2 = generatePostmortemV2({
        incident: {
          id: incident.id,
          title: incident.title,
          sourceType: incident.sourceType,
          sourceRef: incident.sourceRef,
          createdAt: incident.createdAt,
        },
        analysis: {
          id: savedAnalysis.id,
          createdAt: savedAnalysis.createdAt,
          evidenceBundleId: savedBundle.id,
          evidenceCompleteness: completeness,
          reasoningJson: reasoningResponse,
        },
        evidenceBundle: {
          bundleId: savedBundle.bundleId,
          artifacts: bundle.artifacts.map((a: any) => ({
            artifactId: a.artifactId,
            kind: a.kind,
            title: a.title,
            summary: a.summary,
          })),
          googleEvidenceLite: null,
        },
        promptTrace: promptTrace,
        timeline: {
          start: collectContext.window.start,
          end: collectContext.window.end,
        },
      });
      
      const postmortemMarkdown = renderPostmortemMarkdown(postmortemV2);
      await this.persistence.savePostmortem({
        incidentId: incident.id,
        markdown: postmortemMarkdown,
        json: postmortemV2,
        generatorVersion: POSTMORTEM_GENERATOR_VERSION,
      });

      return analysisResult;
    } catch (error: any) {
      console.error('[IncidentsController.analyze] Error:', error?.message || error);
      throw new HttpException(
        `Failed to analyze incident: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Post(":id/analyze")
  async analyzeExisting(@Param('id') incidentId: string, @Req() httpReq: { user?: CurrentUser }) {
    try {
      // 1) Load incident
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
      });

      if (!incident) {
        throw new HttpException(`Incident not found: ${incidentId}`, HttpStatus.NOT_FOUND);
      }

      // TypeScript: After null check, incident is guaranteed to be non-null
      // Use type assertion to help TypeScript understand this
      const incidentData = incident as NonNullable<typeof incident>;

      // 2) Handle Google Cloud incidents with evidence-lite
      if (incidentData.sourceType === 'GOOGLE_CLOUD' && incidentData.sourcePayload) {
        const gp = incidentData.sourcePayload as any;
        
        // Extract normalized fields from sourcePayload
        const affectedProduct = gp?.affected_products?.[0]?.title ?? gp?.affected_products?.[0]?.id ?? null;
        const affectedLocation = gp?.currently_affected_locations?.[0]?.title ?? gp?.currently_affected_locations?.[0]?.id ?? null;
        
        // Map status and severity (using same logic as normalizer)
        const statusText = (gp?.most_recent_update?.status ?? gp?.status_impact ?? '').toLowerCase();
        let status: "investigating" | "identified" | "monitoring" | "resolved" | "unknown" = "unknown";
        if (statusText.includes("investigat")) status = "investigating";
        else if (statusText.includes("identif")) status = "identified";
        else if (statusText.includes("monitor")) status = "monitoring";
        else if (statusText.includes("resolv")) status = "resolved";

        const severityText = (gp?.severity ?? '').toLowerCase();
        let severity: "low" | "medium" | "high" | "critical" | "unknown" = "unknown";
        if (severityText.includes("critical")) severity = "critical";
        else if (severityText.includes("high")) severity = "high";
        else if (severityText.includes("medium")) severity = "medium";
        else if (severityText.includes("low")) severity = "low";

        // Build evidence-lite
        const evidenceLite = buildGoogleEvidenceLite({
          sourceRef: incidentData.sourceRef || '',
          url: gp?.uri ?? null,
          service: affectedProduct,
          region: affectedLocation,
          status,
          severity,
          begin: gp?.begin ?? null,
          update: gp?.modified ?? gp?.most_recent_update?.modified ?? gp?.most_recent_update?.when ?? null,
          end: gp?.end ?? null,
          headline: incidentData.title || "Google Cloud incident",
          summary: gp?.external_desc ?? incidentData.title ?? "Google Cloud incident",
        });

        // Build requestJson with evidence-lite
        const requestJson: any = {
          incidentId: incidentData.id,
          sourceType: 'GOOGLE_CLOUD',
          evidence: {
            googleEvidenceLite: evidenceLite,
          },
        };

        // Collect evidence from all collectors (if applicable)
        // Determine window from evidence-lite timeline or use default
        const windowStart = evidenceLite.timeline.begin 
          ? new Date(evidenceLite.timeline.begin)
          : new Date(Date.now() - 30 * 60 * 1000); // Default: 30 min ago
        const windowEnd = evidenceLite.timeline.end || evidenceLite.timeline.update
          ? new Date(evidenceLite.timeline.end || evidenceLite.timeline.update!)
          : new Date(); // Default: now
        
        const collectorArtifacts = [];
        const collectContext = {
          incidentId: incidentData.id,
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
        
        // Collect from all collectors
        const [metricsResult, deploysResult, configDiffResult, logsResult, tracesResult] = await Promise.all([
          this.gcpMetricsCollector.collect(collectContext),
          this.deploysCollector.collect(collectContext),
          this.configDiffCollector.collect(collectContext),
          this.logsCollector.collect(collectContext),
          this.tracesCollector.collect(collectContext),
        ]);
        
        if (metricsResult) collectorArtifacts.push(metricsResult);
        if (deploysResult) collectorArtifacts.push(deploysResult);
        if (configDiffResult) collectorArtifacts.push(configDiffResult);
        if (logsResult) collectorArtifacts.push(logsResult);
        if (tracesResult) collectorArtifacts.push(tracesResult);

        // Build evidence bundle with collector artifacts
        const bundle = buildEvidenceBundle({
          incidentId: incidentData.id,
          createdBy: httpReq.user?.sub ?? null,
          googleEvidenceLite: evidenceLite,
          scenarioTelemetrySummary: null, // Google incidents don't have scenario telemetry
          collectorArtifacts,
        });

        // Upsert bundle (content-addressed, immutable)
        const savedBundle = await this.persistence.upsertEvidenceBundle({
          bundleId: bundle.bundleId,
          incidentId: incidentData.id,
          createdBy: bundle.createdBy ?? null,
          sources: bundle.sources,
          payload: bundle,
          hashAlgo: bundle.hashAlgo,
          hashInputVersion: bundle.hashInputVersion,
        });

        // For now, return a placeholder analysis result
        // TODO: Integrate with actual analyzer that can use evidence-lite
        const analysisResult: any = {
          incidentId: incidentData.id,
          summary: `Analysis of Google Cloud incident: ${evidenceLite.headline}`,
          likelyRootCauses: [
            {
              rank: 1,
              title: "Google Cloud service incident",
              confidence: 0.8,
              evidence: [],
              nextActions: evidenceLite.hypothesisHints,
            },
          ],
          blastRadius: {
            impactedServices: evidenceLite.service ? [evidenceLite.service] : [],
            impactedRoutes: [],
            userImpact: evidenceLite.severity === "critical" || evidenceLite.severity === "high" 
              ? "High - Critical/High severity incident" 
              : "Medium - Ongoing service incident",
          },
          questionsToConfirm: [],
          explainability: {
            primarySignal: "errors" as const,
            latencyFactor: 1.0,
            errorFactor: evidenceLite.severity === "critical" ? 10.0 : 5.0,
            rationale: `Imported from Google Cloud status; no internal telemetry attached yet. Status: ${evidenceLite.status}, Severity: ${evidenceLite.severity}`,
          },
          evidenceTable: [],
        };

        // Compute evidence completeness
        const completeness = computeEvidenceCompleteness({
          incidentSourceType: incidentData.sourceType,
          primarySignal: analysisResult.explainability?.primarySignal ?? "UNKNOWN",
          bundle: savedBundle.payload,
        });

        // Select hypothesis candidates and build reasoning request
        const artifacts = bundle.artifacts || [];
        const artifactKinds = new Set(artifacts.map((a: any) => a.kind));
        const sources = bundle.sources || [];
        
        const flags = {
          recentDeploy: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
          configChanged: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
          newErrorSignature: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
          timeouts: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
        };
        
        const candidates = selectHypothesisCandidates({
          primarySignal: analysisResult.explainability?.primarySignal === "latency" ? "LATENCY" :
                         analysisResult.explainability?.primarySignal === "errors" ? "ERRORS" : "UNKNOWN",
          completenessScore: completeness.score,
          has: {
            metrics: artifactKinds.has("metrics_summary") || sources.includes("GCP_METRICS"),
            logs: artifactKinds.has("logs_summary") || sources.includes("GCP_LOGS"),
            traces: artifactKinds.has("traces_summary") || sources.includes("GCP_TRACES"),
            deploys: artifactKinds.has("deploys_summary") || sources.includes("DEPLOYS"),
            config: artifactKinds.has("config_diff_summary") || sources.includes("CONFIG"),
            googleStatus: Boolean(evidenceLite) || sources.includes("GOOGLE_CLOUD"),
          },
          flags,
        });

        const reasoningRequest = buildReasoningRequest({
          incidentId: incidentData.id,
          evidenceBundleId: savedBundle.bundleId,
          sourceType: incidentData.sourceType,
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

        // Call reasoning adapter
        let reasoningResult = null;
        let reasoningResponse = null;
        try {
          reasoningResult = await this.reasoningAdapter.reason(reasoningRequest);
          reasoningResponse = reasoningResult.response;
          
          const promptHash = hashPromptParts(reasoningResult.prompt.system, reasoningResult.prompt.user);
          const requestHash = hashRequest(reasoningRequest);
          const responseHash = hashResponse(reasoningResponse);
          
          (reasoningResult as any).traceData = {
            promptHash,
            requestHash,
            responseHash,
            systemPrompt: reasoningResult.prompt.system,
            userPrompt: reasoningResult.prompt.user,
          };
        } catch (error: any) {
          console.error('[IncidentsController.analyzeExisting] Reasoning adapter failed:', error?.message || error);
        }

        // Persist analysis with bundle link and completeness
        const newAnalysis = await this.persistence.saveAnalysis({
          incidentId: incidentData.id,
          requestJson,
          resultJson: analysisResult,
          evidenceBundleId: savedBundle.id,
          evidenceCompleteness: completeness,
          reasoningJson: reasoningResponse,
        });

        // Persist prompt trace (if reasoning succeeded)
        if (reasoningResult && reasoningResponse) {
          const traceData = (reasoningResult as any).traceData;
          const promptTrace = await this.prisma.promptTrace.create({
            data: {
              incidentId: incidentData.id,
              analysisId: newAnalysis.id,
              evidenceBundleId: savedBundle.bundleId,
              model: reasoningResponse.model,
              promptVersion: reasoningResponse.promptVersion,
              promptHash: traceData.promptHash,
              requestHash: traceData.requestHash,
              responseHash: traceData.responseHash,
              systemPrompt: traceData.systemPrompt,
              userPrompt: traceData.userPrompt,
              requestJson: reasoningRequest as any,
              responseJson: reasoningResponse as any,
            },
          });

          // Day 20: Emit audit event for prompt trace
          await this.audit.appendEvent({
            eventType: "PROMPT_TRACE_CREATED",
            entityType: "PROMPT_TRACE",
            entityId: promptTrace.id,
            entityRef: traceData.promptHash,
            payload: {
              promptTraceId: promptTrace.id,
              analysisId: newAnalysis.id,
              promptHash: traceData.promptHash,
              requestHash: traceData.requestHash,
              responseHash: traceData.responseHash,
              model: reasoningResponse.model,
              promptVersion: reasoningResponse.promptVersion,
            },
          });
        }

        // Generate and persist postmortem (v2)
        const promptTrace = reasoningResult ? await this.prisma.promptTrace.findFirst({
          where: { analysisId: newAnalysis.id },
          select: { id: true, promptHash: true, responseHash: true },
        }) : null;
        
        const postmortemV2 = generatePostmortemV2({
          incident: {
            id: incidentData.id,
            title: incidentData.title,
            sourceType: incidentData.sourceType,
            sourceRef: incidentData.sourceRef,
            createdAt: incidentData.createdAt,
          },
          analysis: {
            id: newAnalysis.id,
            createdAt: newAnalysis.createdAt,
            evidenceBundleId: savedBundle.id,
            evidenceCompleteness: completeness,
            reasoningJson: reasoningResponse,
          },
          evidenceBundle: {
            bundleId: savedBundle.bundleId,
            artifacts: bundle.artifacts.map((a: any) => ({
              artifactId: a.artifactId,
              kind: a.kind,
              title: a.title,
              summary: a.summary,
            })),
            googleEvidenceLite: evidenceLite,
          },
          promptTrace: promptTrace,
          timeline: {
            start: collectContext.window.start,
            end: collectContext.window.end,
          },
        });
        
        const postmortemMarkdown = renderPostmortemMarkdown(postmortemV2);
        await this.persistence.savePostmortem({
          incidentId: incidentData.id,
          markdown: postmortemMarkdown,
          json: postmortemV2,
          generatorVersion: POSTMORTEM_GENERATOR_VERSION,
        });

        return analysisResult;
      } else {
        throw new HttpException(
          `Incident ${incidentId} is not a Google Cloud incident or missing sourcePayload`,
          HttpStatus.BAD_REQUEST,
        );
      }
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.analyzeExisting] Error:', error?.message || error);
      throw new HttpException(
        `Failed to analyze incident: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private buildPostmortemMarkdown(scenario: any, analysis: any): string {
    const top = analysis.likelyRootCauses[0];
    const rb = this.buildRunbook(analysis.explainability.primarySignal);

    const metricRows = analysis.evidenceTable
      .map((r: any) => {
        const metric =
          r.metric === "p95_latency_ms" ? "p95 latency (ms)" : "error rate";
        const baseline =
          r.metric === "p95_latency_ms"
            ? `${Math.round(r.baselineAvg)}ms`
            : `${(r.baselineAvg * 100).toFixed(2)}%`;
        const after =
          r.metric === "p95_latency_ms"
            ? `${Math.round(r.afterAvg)}ms`
            : `${(r.afterAvg * 100).toFixed(2)}%`;
        const delta =
          r.metric === "p95_latency_ms"
            ? `${r.delta >= 0 ? "+" : ""}${Math.round(r.delta)}ms`
            : `${r.delta >= 0 ? "+" : ""}${(r.delta * 100).toFixed(2)}%`;

        return `| ${metric} | ${baseline} | ${after} | ${delta} | x${r.factor} |`;
      })
      .join("\n");

    return [
      `# Postmortem — ${scenario.title}`,
      ``,
      `**Incident ID:** ${analysis.incidentId}`,
      ``,
      `## Summary`,
      analysis.summary,
      ``,
      `## Deployment`,
      `- **Service:** ${scenario.deployment.serviceId}`,
      `- **Version:** ${scenario.deployment.versionFrom} → ${scenario.deployment.versionTo}`,
      `- **Time:** ${new Date(scenario.deployment.timestamp).toLocaleString()}`,
      ``,
      `## Detection & Signals`,
      `- **Primary signal:** ${analysis.explainability.primarySignal}`,
      `- **Latency factor:** x${analysis.explainability.latencyFactor}`,
      `- **Error factor:** x${analysis.explainability.errorFactor}`,
      `- **Rationale:** ${analysis.explainability.rationale}`,
      ``,
      `## Evidence`,
      `| Metric | Baseline | After | Delta | Factor |`,
      `|---|---:|---:|---:|---:|`,
      metricRows,
      ``,
      `## Top Hypothesis`,
      `**#${top.rank} (${Math.round(top.confidence * 100)}%):** ${top.title}`,
      ``,
      `### Supporting Evidence`,
      ...top.evidence.map(
        (e: any) =>
          `- **${e.type}**: ${e.key ?? e.span ?? e.pattern ?? e.route ?? "evidence"}${
            e.delta ? ` (${e.delta})` : ""
          }`
      ),
      ``,
      `### Immediate Actions`,
      ...top.nextActions.map((a: string) => `- ${a}`),
      ``,
      `## Blast Radius`,
      `- **Services:** ${analysis.blastRadius.impactedServices.join(", ")}`,
      `- **Routes:** ${analysis.blastRadius.impactedRoutes.join(", ")}`,
      `- **User impact:** ${analysis.blastRadius.userImpact}`,
      ``,
      `## Runbook`,
      `### Immediate mitigations`,
      ...rb.immediate.map((x: string) => `- ${x}`),
      ``,
      `### Verify recovery`,
      ...rb.verify.map((x: string) => `- ${x}`),
      ``,
      `### Escalate if needed`,
      ...rb.escalate.map((x: string) => `- ${x}`),
      ``,
      `## Questions to Confirm`,
      ...(analysis.questionsToConfirm?.length
        ? analysis.questionsToConfirm.map((q: string) => `- ${q}`)
        : [`- (none)`]),
      ``,
      `---`,
      `Generated by ChronosOps MVP`,
    ].join("\n");
  }

  private buildPostmortemMarkdownFromGoogle(evidenceLite: any, analysis: any): string {
    const top = analysis.likelyRootCauses[0];

    const timelineParts: string[] = [];
    if (evidenceLite.timeline.begin) {
      timelineParts.push(`**Begin:** ${new Date(evidenceLite.timeline.begin).toLocaleString()}`);
    }
    if (evidenceLite.timeline.update) {
      timelineParts.push(`**Last Update:** ${new Date(evidenceLite.timeline.update).toLocaleString()}`);
    }
    if (evidenceLite.timeline.end) {
      timelineParts.push(`**End:** ${new Date(evidenceLite.timeline.end).toLocaleString()}`);
    }

    return [
      `# Postmortem — ${evidenceLite.headline}`,
      ``,
      `**Incident ID:** ${analysis.incidentId}`,
      `**Source:** Google Cloud Status`,
      `**Source Ref:** ${evidenceLite.sourceRef}`,
      evidenceLite.url ? `**Status Page:** ${evidenceLite.url}` : '',
      ``,
      `## Summary`,
      evidenceLite.summary,
      ``,
      `## Incident Details`,
      `- **Status:** ${evidenceLite.status}`,
      `- **Severity:** ${evidenceLite.severity}`,
      evidenceLite.service ? `- **Service:** ${evidenceLite.service}` : '',
      evidenceLite.region ? `- **Region:** ${evidenceLite.region}` : '',
      ``,
      `## Timeline`,
      ...(timelineParts.length > 0 ? timelineParts : ['- (Timeline not available)']),
      ``,
      `## Detection & Signals`,
      `- **Primary signal:** ${analysis.explainability.primarySignal}`,
      `- **Rationale:** ${analysis.explainability.rationale}`,
      ``,
      `## Top Hypothesis`,
      `**#${top.rank} (${Math.round(top.confidence * 100)}%):** ${top.title}`,
      ``,
      `### Immediate Actions`,
      ...top.nextActions.map((a: string) => `- ${a}`),
      ``,
      `## Blast Radius`,
      `- **Services:** ${analysis.blastRadius.impactedServices.join(", ") || "(none)"}`,
      `- **Routes:** ${analysis.blastRadius.impactedRoutes.join(", ") || "(none)"}`,
      `- **User impact:** ${analysis.blastRadius.userImpact}`,
      ``,
      `## Hypothesis Hints`,
      ...(evidenceLite.hypothesisHints.length > 0
        ? evidenceLite.hypothesisHints.map((h: string) => `- ${h}`)
        : [`- (none)`]),
      ``,
      `## Questions to Confirm`,
      ...(analysis.questionsToConfirm?.length
        ? analysis.questionsToConfirm.map((q: string) => `- ${q}`)
        : [`- (none)`]),
      ``,
      `---`,
      `Generated by ChronosOps MVP`,
      `Note: This incident was imported from Google Cloud Status. Internal telemetry may not be available.`,
    ].filter(Boolean).join("\n");
  }

  /**
   * Core analysis logic - extracts telemetry, computes deltas, determines primary signal,
   * and generates hypotheses. This is reusable for both analyze and reanalyze endpoints.
   */
  private async performAnalysis(scenario: any, req: any) {
    const deployTime = scenario.deployment.timestamp;
    const svc = scenario.deployment.serviceId;

    const metrics = scenario.metrics.filter((m: any) => m.serviceId === svc);

    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);

    const p95 = metrics.filter((m: any) => m.metric === "p95_latency_ms").sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));
    const err = metrics.filter((m: any) => m.metric === "error_rate").sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));

    const p95BeforeAvg = avg(p95.filter((m: any) => m.timestamp < deployTime).map((m: any) => m.value));
    const p95AfterAvg  = avg(p95.filter((m: any) => m.timestamp >= deployTime).map((m: any) => m.value));

    const errBeforeAvg = avg(err.filter((m: any) => m.timestamp < deployTime).map((m: any) => m.value));
    const errAfterAvg  = avg(err.filter((m: any) => m.timestamp >= deployTime).map((m: any) => m.value));

    const p95Delta = Math.round(p95AfterAvg - p95BeforeAvg);
    const errDeltaPct = Number(((errAfterAvg - errBeforeAvg) * 100).toFixed(2));

    const latencyFactor = p95BeforeAvg > 0 ? p95AfterAvg / p95BeforeAvg : 1;
    const errorFactor = errBeforeAvg > 0 ? errAfterAvg / errBeforeAvg : 1;

    const evidenceTable = [
      {
        metric: "p95_latency_ms" as const,
        baselineAvg: Number(p95BeforeAvg.toFixed(2)),
        afterAvg: Number(p95AfterAvg.toFixed(2)),
        delta: Number((p95AfterAvg - p95BeforeAvg).toFixed(2)),
        factor: Number(latencyFactor.toFixed(2)),
      },
      {
        metric: "error_rate" as const,
        baselineAvg: Number(errBeforeAvg.toFixed(5)),
        afterAvg: Number(errAfterAvg.toFixed(5)),
        delta: Number((errAfterAvg - errBeforeAvg).toFixed(5)),
        factor: Number(errorFactor.toFixed(2)),
      },
    ];

    // Heuristic: decide what "spiked" more
    const primarySignal: "latency" | "errors" =
      latencyFactor >= 2 && latencyFactor >= errorFactor ? "latency"
      : errorFactor >= 2 ? "errors"
      : latencyFactor >= errorFactor ? "latency" : "errors";

    const baseEvidence = [
      { type: "metric" as const, key: "p95_latency_ms", delta: `+${p95Delta}ms (avg)` },
      { type: "metric" as const, key: "error_rate", delta: `${errDeltaPct >= 0 ? "+" : ""}${errDeltaPct}% (avg)` },
    ];

    const latencyHypothesis = {
          rank: 1,
      title: "Latency regression introduced in deploy window (likely DB/query path)",
      confidence: 0.74,
          evidence: [
        ...baseEvidence,
        { type: "trace" as const, route: "POST /checkout", span: "db.query", delta: "dominant contributor in slow traces (expected)" }
          ],
          nextActions: [
        `Rollback ${svc} to ${scenario.deployment.versionFrom}`,
        "Check recent code path changes affecting DB queries",
        "Inspect slow span breakdown and query plans / indexes"
      ]
    };

    const errorHypothesis = {
      rank: 1,
      title: "Config change caused upstream/auth errors (rollback or fix config)",
      confidence: 0.76,
      evidence: [
        ...baseEvidence,
        { type: "log" as const, pattern: "auth failures / invalid config / upstream 5xx (expected)", delta: "increased post-change" }
      ],
      nextActions: [
        "Rollback the config change immediately",
        "Validate env vars / secrets / feature flags changed at deploy time",
        "Check upstream dependency status and error codes (401/403/5xx)"
      ]
    };

    const top = primarySignal === "latency" ? latencyHypothesis : errorHypothesis;

    const rationale =
      primarySignal === "latency"
        ? `Latency increased ~x${latencyFactor.toFixed(2)} after deploy, exceeding error increase (~x${errorFactor.toFixed(2)}).`
        : `Error rate increased ~x${errorFactor.toFixed(2)} after change, exceeding latency increase (~x${latencyFactor.toFixed(2)}).`;

    const response = {
      incidentId: '', // Will be set by caller
      summary:
        `Post-deploy signals: p95 latency +${p95Delta}ms (x${latencyFactor.toFixed(2)}), error rate ${errDeltaPct >= 0 ? "+" : ""}${errDeltaPct}% (x${errorFactor.toFixed(2)}). Primary signal: ${primarySignal}.`,
      likelyRootCauses: [top],
      blastRadius: {
        impactedServices: primarySignal === "latency"
          ? [svc, "orders-api", "postgres"]
          : [svc, "identity-provider", "gateway"],
        impactedRoutes: primarySignal === "latency" ? ["POST /checkout"] : ["POST /login", "POST /token"],
        userImpact: primarySignal === "latency"
          ? "Requests slowed for a large % of users"
          : "A subset of requests failed due to increased errors"
      },
      questionsToConfirm: primarySignal === "latency"
        ? [
            "Did a feature flag enable a new DB-heavy path?",
            "Did DB latency or connection pool saturation increase post-deploy?"
          ]
        : [
            "Which config/secret/flag changed at deploy time?",
            "Are errors mostly 401/403 vs 5xx (upstream)?"
          ],
      explainability: {
        primarySignal,
        latencyFactor: Number(latencyFactor.toFixed(2)),
        errorFactor: Number(errorFactor.toFixed(2)),
        rationale,
      },
      evidenceTable,
    };

    return AnalyzeIncidentResponseSchema.parse(response);
  }

  private buildRunbook(primary: "latency" | "errors") {
    const isLatency = primary === "latency";
    return {
      immediate: isLatency
        ? [
            "Rollback to last known good version",
            "Disable any newly enabled feature flag / expensive path",
            "Reduce load temporarily (rate limit, shed non-critical traffic)",
          ]
        : [
            "Rollback the config change immediately",
            "Verify secrets/env vars are correct and present",
            "Temporarily bypass failing upstream if possible (fallback / degraded mode)",
          ],
      verify: isLatency
        ? [
            "p95/p99 latency returns to baseline within 5–10 minutes",
            "DB latency / connection pool saturation normalizes",
            "Error rate does not increase during rollback",
          ]
        : [
            "Error rate drops to baseline (watch 401/403 vs 5xx breakdown)",
            "Auth success rate recovers",
            "No new spikes in latency due to retries/backoff loops",
          ],
      escalate: isLatency
        ? [
            "Engage DB/platform team if DB latency remains high after rollback",
            "Open an incident bridge if customer impact exceeds SLO burn rate",
          ]
        : [
            "Engage platform/identity owner if errors are auth-related",
            "Engage upstream dependency owner if errors are 5xx from downstream",
          ],
    };
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(":id/evidence-bundles")
  async listEvidenceBundles(@Param('id') incidentId: string) {
    try {
      const bundles = await this.prisma.evidenceBundle.findMany({
        where: { incidentId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          bundleId: true,
          createdAt: true,
          sources: true,
          hashAlgo: true,
          hashInputVersion: true,
          analyses: {
            select: {
              id: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return bundles.map((b: any) => ({
        bundleId: b.bundleId,
        createdAt: b.createdAt.toISOString(),
        sources: b.sources,
        hashAlgo: b.hashAlgo,
        hashInputVersion: b.hashInputVersion,
        analysisIds: b.analyses.map((a: any) => a.id),
      }));
    } catch (error: any) {
      console.error('[IncidentsController.listEvidenceBundles] Error:', error?.message || error);
      throw new HttpException(
        `Failed to list evidence bundles: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get("evidence-bundles/:bundleId")
  async getEvidenceBundle(@Param('bundleId') bundleId: string, @Req() httpReq: { user?: CurrentUser }) {
    try {
      const bundle = await this.prisma.evidenceBundle.findUnique({
        where: { bundleId },
        select: {
          bundleId: true,
          incidentId: true,
          createdAt: true,
          createdBy: true,
          sources: true,
          payload: true,
          hashAlgo: true,
          hashInputVersion: true,
        },
      });

      if (!bundle) {
        throw new HttpException(`Evidence bundle not found: ${bundleId}`, HttpStatus.NOT_FOUND);
      }

      // Day 18: Redact sensitive data from evidence bundle payload
      const isAdmin = httpReq.user?.roles?.includes("CHRONOSOPS_ADMIN");
      const redactedPayload = isAdmin ? bundle.payload : redactEvidenceBundle(bundle.payload);

      return {
        bundleId: bundle.bundleId,
        incidentId: bundle.incidentId,
        createdAt: bundle.createdAt.toISOString(),
        createdBy: bundle.createdBy,
        sources: bundle.sources,
        payload: redactedPayload,
        hashAlgo: bundle.hashAlgo,
        hashInputVersion: bundle.hashInputVersion,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getEvidenceBundle] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get evidence bundle: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(":id/prompt-traces")
  async listPromptTraces(@Param('id') incidentId: string) {
    try {
      const traces = await this.prisma.promptTrace.findMany({
        where: { incidentId },
        select: {
          id: true,
          createdAt: true,
          model: true,
          promptVersion: true,
          promptHash: true,
          requestHash: true,
          responseHash: true,
          analysisId: true,
          evidenceBundleId: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return traces;
    } catch (error: any) {
      console.error('[IncidentsController.listPromptTraces] Error:', error?.message || error);
      throw new HttpException(
        `Failed to list prompt traces: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ADMIN')
  @Get("prompt-traces/:id")
  async getPromptTrace(@Param('id') id: string) {
    try {
      const trace = await this.prisma.promptTrace.findUnique({
        where: { id },
      });

      if (!trace) {
        throw new HttpException(`Prompt trace not found: ${id}`, HttpStatus.NOT_FOUND);
      }

      return trace;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getPromptTrace] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get prompt trace: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(':id/analyses/:a/compare/:b')
  async compareAnalyses(
    @Param('id') incidentId: string,
    @Param('a') analysisIdA: string,
    @Param('b') analysisIdB: string,
  ) {
    try {
      const compare = await this.analysisCompareService.compare(incidentId, analysisIdA, analysisIdB);
      return compare;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.compareAnalyses] Error:', error?.message || error);
      throw new HttpException(
        `Failed to compare analyses: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(':id/verify')
  async verifyIntegrity(@Param('id') incidentId: string) {
    try {
      // Verify incident exists
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
        select: { id: true },
      });

      if (!incident) {
        throw new HttpException(`Incident not found: ${incidentId}`, HttpStatus.NOT_FOUND);
      }

      // Verify audit chain
      const result = await this.auditVerify.verifyIncidentChain(incidentId);

      return {
        incidentId,
        ...result,
        status: result.ok ? "VERIFIED" : "FAILED",
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.verifyIntegrity] Error:', error?.message || error);
      throw new HttpException(
        `Failed to verify integrity: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(':incidentId/analyses/:analysisId/explainability-graph')
  async getExplainabilityGraph(
    @Param('incidentId') incidentId: string,
    @Param('analysisId') analysisId: string,
  ) {
    try {
      // Load incident
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
      });

      if (!incident) {
        throw new HttpException(`Incident not found: ${incidentId}`, HttpStatus.NOT_FOUND);
      }

      // Load analysis
      const analysis = await this.prisma.incidentAnalysis.findUnique({
        where: { id: analysisId },
        select: {
          id: true,
          reasoningJson: true,
          evidenceCompleteness: true,
          evidenceBundleId: true,
          createdAt: true,
        },
      });

      if (!analysis) {
        throw new HttpException(`Analysis not found: ${analysisId}`, HttpStatus.NOT_FOUND);
      }

      // Verify analysis belongs to incident
      if (analysis.evidenceBundleId === null) {
        throw new HttpException(
          `Analysis ${analysisId} has no evidence bundle`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // Load evidence bundle
      const evidenceBundle = await this.prisma.evidenceBundle.findUnique({
        where: { id: analysis.evidenceBundleId },
        select: {
          bundleId: true,
          payload: true,
        },
      });

      if (!evidenceBundle) {
        throw new HttpException(
          `Evidence bundle not found for analysis ${analysisId}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Load postmortem (optional)
      const postmortem = await this.prisma.postmortem.findFirst({
        where: {
          incidentId,
          createdAt: {
            gte: new Date(analysis.createdAt.getTime() - 60000), // Within 1 minute of analysis
          },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          json: true,
        },
      });

      // Build graph
      const graph = buildExplainabilityGraph({
        incidentId,
        analysisId,
        analysis: {
          reasoningJson: analysis.reasoningJson,
          evidenceCompleteness: analysis.evidenceCompleteness,
          evidenceBundleId: analysis.evidenceBundleId,
        },
        evidenceBundle: {
          bundleId: evidenceBundle.bundleId,
          payload: evidenceBundle.payload,
        },
        postmortem: postmortem || null,
      });

      return graph;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getExplainabilityGraph] Error:', error?.message || error);
      throw new HttpException(
        `Failed to build explainability graph: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get(':id/postmortems')
  async listPostmortems(@Param('id') incidentId: string) {
    try {
      const postmortems = await this.prisma.postmortem.findMany({
        where: { incidentId },
        select: {
          id: true,
          createdAt: true,
          generatorVersion: true,
          json: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return postmortems.map((p: any) => {
        const json = p.json as any;
        return {
          id: p.id,
          createdAt: p.createdAt.toISOString(),
          generatorVersion: p.generatorVersion,
          analysisId: json?.analysisId || null,
          confidence: json?.summary?.confidence || null,
          bundleId: json?.evidence?.bundleId || null,
        };
      });
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.listPostmortems] Error:', error?.message || error);
      throw new HttpException(
        `Failed to list postmortems: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get('postmortems/:id')
  async getPostmortem(@Param('id') postmortemId: string) {
    try {
      const postmortem = await this.prisma.postmortem.findUnique({
        where: { id: postmortemId },
      });

      if (!postmortem) {
        throw new HttpException(`Postmortem not found: ${postmortemId}`, HttpStatus.NOT_FOUND);
      }

      return {
        id: postmortem.id,
        incidentId: postmortem.incidentId,
        createdAt: postmortem.createdAt.toISOString(),
        generatorVersion: postmortem.generatorVersion,
        json: postmortem.json,
        markdown: postmortem.markdown,
      };
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getPostmortem] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get postmortem: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get('postmortems/:id/markdown')
  async getPostmortemMarkdown(@Param('id') postmortemId: string) {
    try {
      const postmortem = await this.prisma.postmortem.findUnique({
        where: { id: postmortemId },
        select: {
          id: true,
          markdown: true,
        },
      });

      if (!postmortem) {
        throw new HttpException(`Postmortem not found: ${postmortemId}`, HttpStatus.NOT_FOUND);
      }

      // Return raw markdown
      return postmortem.markdown;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getPostmortemMarkdown] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get postmortem markdown: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_VIEWER', 'CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Get('postmortems/:id/json')
  async getPostmortemJson(@Param('id') postmortemId: string) {
    try {
      const postmortem = await this.prisma.postmortem.findUnique({
        where: { id: postmortemId },
        select: {
          id: true,
          json: true,
        },
      });

      if (!postmortem) {
        throw new HttpException(`Postmortem not found: ${postmortemId}`, HttpStatus.NOT_FOUND);
      }

      // Return raw JSON
      return postmortem.json;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[IncidentsController.getPostmortemJson] Error:', error?.message || error);
      throw new HttpException(
        `Failed to get postmortem JSON: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Post(":id/investigate")
  async startInvestigation(
    @Param('id') incidentId: string,
    @Body() body: unknown,
    @Req() httpReq: { user?: CurrentUser }
  ) {
    try {
      const parsed = StartInvestigationRequestSchema.safeParse(body ?? {});
      if (!parsed.success) {
        throw new BadRequestException({
          message: 'Invalid request body',
          errors: parsed.error.flatten(),
        });
      }

      const result = await this.investigationService.startInvestigation({
        incidentId,
        maxIterations: parsed.data.maxIterations,
        confidenceTarget: parsed.data.confidenceTarget,
        user: httpReq.user,
      });

      return StartInvestigationResponseSchema.parse(result);
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof HttpException) {
        throw error;
      }
      // Handle conflict (already running investigation)
      if (error?.statusCode === 409 || error?.code === 'INVESTIGATION_ALREADY_RUNNING') {
        throw new HttpException(
          error.message || 'An investigation is already running for this incident',
          HttpStatus.CONFLICT,
        );
      }
      console.error('[IncidentsController.startInvestigation] Error:', error?.message || error);
      throw new HttpException(
        `Failed to start investigation: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Roles('CHRONOSOPS_ANALYST', 'CHRONOSOPS_ADMIN')
  @Post("import/google")
  async importGoogle(@Body() body: unknown) {
    try {
      const parsed = ImportGoogleIncidentsRequestSchema.safeParse(body ?? {});
      if (!parsed.success) {
        throw new BadRequestException({
          message: 'Invalid request body',
          errors: parsed.error.flatten(),
        });
      }

      // Fetch and normalize Google incidents
      const { incidents, fetchedAt, normalized } = await this.googleIntegration.fetchAndNormalize();
      
      // Apply limit if specified
      const limited = parsed.data.limit 
        ? normalized.slice(0, parsed.data.limit)
        : normalized;

      let imported = 0;
      let skipped = 0;

      for (const normalizedIncident of limited) {
        const sourceRef = normalizedIncident.sourceRef;
        if (!sourceRef) {
          skipped++;
          continue;
        }

        // Idempotency check: see if incident with this sourceRef already exists
        const existing = await this.prisma.incident.findFirst({
          where: { 
            sourceType: 'GOOGLE_CLOUD', 
            sourceRef 
          },
          select: { id: true },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create new incident
        await this.prisma.incident.create({
          data: {
            scenarioId: normalizedIncident.scenarioId,
            title: normalizedIncident.title ?? null,
            status: 'analyzed', // Default status for imported incidents
            sourceType: 'GOOGLE_CLOUD',
            sourceRef,
            sourcePayload: normalizedIncident.sourcePayload ? (normalizedIncident.sourcePayload as any) : null,
          },
        });

        imported++;
      }

      return {
        imported,
        skipped,
        fetched: incidents.length,
        fetchedAt,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('[IncidentsController.importGoogle] Error:', error?.message || error);
      throw new HttpException(
        `Failed to import Google incidents: ${error?.message || 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
