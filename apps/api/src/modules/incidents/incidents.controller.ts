import { Body, Controller, Post } from "@nestjs/common";
import { AnalyzeIncidentRequestSchema, AnalyzeIncidentResponseSchema } from "@chronosops/contracts";
import { ScenarioService } from "../scenario/scenario.service";

@Controller("v1/incidents")
export class IncidentsController {
  constructor(private readonly scenarios: ScenarioService) {}

  @Post("analyze")
  async analyze(@Body() body: any) {
    const req = AnalyzeIncidentRequestSchema.parse(body);
    const scenario = this.scenarios.getById(req.scenarioId);

    const deployTime = scenario.deployment.timestamp;
    const svc = scenario.deployment.serviceId;

    const metrics = scenario.metrics.filter(m => m.serviceId === svc);

    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);

    const p95 = metrics.filter(m => m.metric === "p95_latency_ms").sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const err = metrics.filter(m => m.metric === "error_rate").sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const p95BeforeAvg = avg(p95.filter(m => m.timestamp < deployTime).map(m => m.value));
    const p95AfterAvg  = avg(p95.filter(m => m.timestamp >= deployTime).map(m => m.value));

    const errBeforeAvg = avg(err.filter(m => m.timestamp < deployTime).map(m => m.value));
    const errAfterAvg  = avg(err.filter(m => m.timestamp >= deployTime).map(m => m.value));

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

    const incidentId = `inc_${Date.now()}`;

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
      incidentId,
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
}
