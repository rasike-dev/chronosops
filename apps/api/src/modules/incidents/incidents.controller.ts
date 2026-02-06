import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from "@nestjs/common";
import { AnalyzeIncidentRequestSchema, AnalyzeIncidentResponseSchema } from "@chronosops/contracts";
import { ScenarioService } from "../scenario/scenario.service";
import { IncidentsPersistenceService } from "./incidents.persistence.service";
import { PrismaService } from "../../prisma/prisma.service";
import { Public } from "../../auth/public.decorator";
import { Roles } from "../../auth/roles.decorator";

@Controller("v1/incidents")
export class IncidentsController {
  constructor(
    private readonly scenarios: ScenarioService,
    private readonly persistence: IncidentsPersistenceService,
    private readonly prisma: PrismaService,
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
  async detail(@Param('id') id: string) {
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
  async reanalyze(@Param('id') incidentId: string) {
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
      const req = AnalyzeIncidentRequestSchema.parse(originalRequest);

      // 4) Re-run analyzer using stored requestJson (same logic as analyze endpoint)
      // This uses the same performAnalysis() function, ensuring same output shape
      const scenario = this.scenarios.getById(req.scenarioId);
      const analysisResult = await this.performAnalysis(scenario, req);
      
      // Set incidentId in the result (same as analyze endpoint)
      analysisResult.incidentId = incident.id;
      
      // Verify: analysisResult includes explainability + evidenceTable (same output shape)

      // 5) Persist new analysis row (always inserts - preserves audit trail)
      // Fields: incidentId, requestJson (stored one), resultJson (new result)
      const newAnalysis = await this.persistence.saveAnalysis({
        incidentId: incident.id,
        requestJson: req, // The stored requestJson from original analysis
        resultJson: analysisResult, // New result from current analyzer logic
      });

      // 6) Generate and save new postmortem snapshot (always inserts - preserves full history)
      const markdown = this.buildPostmortemMarkdown(scenario, analysisResult);
      const newPostmortem = await this.persistence.savePostmortem({
        incidentId: incident.id,
        markdown,
        json: analysisResult,
      });

      // 7) Return result with metadata
      return {
        incidentId: incident.id,
        analysisId: newAnalysis.id,
        postmortemId: newPostmortem.id,
        result: analysisResult,
      };
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
  async analyze(@Body() body: any) {
    try {
    const req = AnalyzeIncidentRequestSchema.parse(body);
      const scenario = this.scenarios.getById(req.scenarioId);

      // 1) Create incident
      const incident = await this.persistence.createIncident({
        scenarioId: req.scenarioId,
        title: scenario.title,
      });

      // 2) Perform analysis
      const analysisResult = await this.performAnalysis(scenario, req);
      
      // Set incidentId in the response
      analysisResult.incidentId = incident.id;

      // 3) Persist analysis
      await this.persistence.saveAnalysis({
        incidentId: incident.id,
        requestJson: req,
        resultJson: analysisResult,
      });

      // 4) Generate and persist postmortem
      const markdown = this.buildPostmortemMarkdown(scenario, analysisResult);
      const json = analysisResult;

      await this.persistence.savePostmortem({
        incidentId: incident.id,
        markdown,
        json,
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
}
