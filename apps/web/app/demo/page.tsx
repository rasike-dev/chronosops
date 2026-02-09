"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScenarioSchema,
  ScenarioListSchema,
  AnalyzeIncidentResponseSchema,
  type Scenario,
  type ScenarioListItem,
  type AnalyzeIncidentResponse,
} from "@chronosops/contracts";

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
}

function pct(x: number) {
  return `${(x * 100).toFixed(2)}%`;
}

export default function LatencySpikeDemo() {
  const scenarioRef = useRef<HTMLDivElement | null>(null);
  const briefRef = useRef<HTMLDivElement | null>(null);

  const [scenarioList, setScenarioList] = useState<ScenarioListItem[]>([]);
  const [scenarioId, setScenarioId] = useState("latency-spike");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeIncidentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [highlightTop, setHighlightTop] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1400);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/v1/scenarios`);
        if (!res.ok) {
          throw new Error(`Failed to load scenarios: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setScenarioList(ScenarioListSchema.parse(json));
      } catch (e: any) {
        console.error("Failed to load scenarios:", e);
        setErr(e?.message ?? "Failed to load scenarios");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setScenario(null);
        setAnalysis(null);
        const res = await fetch(`/api/v1/scenarios/${scenarioId}`);
        if (!res.ok) {
          throw new Error(`Failed to load scenario: ${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        setScenario(ScenarioSchema.parse(json));
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load scenario");
      }
    })();
  }, [scenarioId]);

  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        const res = await fetch("/api/v1/version", { cache: "no-store" });
        if (!alive) return;
        setApiStatus(res.ok ? "connected" : "disconnected");
      } catch {
        if (!alive) return;
        setApiStatus("disconnected");
      }
    };

    check();
    const t = window.setInterval(check, 5000);

    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, []);

  const analyze = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/incidents/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, windowMinutesBefore: 15, windowMinutesAfter: 15 }),
      });
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`Analyze failed: ${res.status} ${errorJson.message || res.statusText}`);
      }
      const json = await res.json();
      setAnalysis(AnalyzeIncidentResponseSchema.parse(json));
    } catch (e: any) {
      setErr(e?.message ?? "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = async () => {
    if (!analysis) return;

    const top = analysis.likelyRootCauses[0];

    const text = [
      `ChronosOps Incident Brief`,
      `Incident: ${analysis.incidentId}`,
      ``,
      `Summary:`,
      analysis.summary,
      ``,
      `Top hypothesis (#${top.rank}, ${Math.round(top.confidence * 100)}%):`,
      top.title,
      ``,
      `Evidence:`,
      ...top.evidence.map(e => `- ${e.type}: ${e.key ?? e.span ?? e.pattern ?? e.route ?? "evidence"} ${e.delta ? `(${e.delta})` : ""}`),
      ``,
      `Next actions:`,
      ...top.nextActions.map(a => `- ${a}`),
      ``,
      `Blast radius:`,
      `- Services: ${analysis.blastRadius.impactedServices.join(", ")}`,
      `- Routes: ${analysis.blastRadius.impactedRoutes.join(", ")}`,
      `- User impact: ${analysis.blastRadius.userImpact}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    showToast("Copied incident brief ✅");
  };

  const buildRunbook = (primary: "latency" | "errors") => {
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
  };

  const copyPostmortem = async () => {
    if (!analysis || !scenario) return;

    const top = analysis.likelyRootCauses[0];
    const rb = buildRunbook(analysis.explainability.primarySignal);

    const metricRows = analysis.evidenceTable
      .map((r) => {
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

    const md = [
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
        (e) =>
          `- **${e.type}**: ${e.key ?? e.span ?? e.pattern ?? e.route ?? "evidence"}${
            e.delta ? ` (${e.delta})` : ""
          }`
      ),
      ``,
      `### Immediate Actions`,
      ...top.nextActions.map((a) => `- ${a}`),
      ``,
      `## Blast Radius`,
      `- **Services:** ${analysis.blastRadius.impactedServices.join(", ")}`,
      `- **Routes:** ${analysis.blastRadius.impactedRoutes.join(", ")}`,
      `- **User impact:** ${analysis.blastRadius.userImpact}`,
      ``,
      `## Runbook`,
      `### Immediate mitigations`,
      ...rb.immediate.map((x) => `- ${x}`),
      ``,
      `### Verify recovery`,
      ...rb.verify.map((x) => `- ${x}`),
      ``,
      `### Escalate if needed`,
      ...rb.escalate.map((x) => `- ${x}`),
      ``,
      `## Questions to Confirm`,
      ...(analysis.questionsToConfirm?.length
        ? analysis.questionsToConfirm.map((q) => `- ${q}`)
        : [`- (none)`]),
      ``,
      `---`,
      `Generated by ChronosOps v2.0.1`,
    ].join("\n");

    await navigator.clipboard.writeText(md);
    showToast("Copied postmortem ✅");
  };

  const copyIncidentJson = async () => {
    if (!analysis) return;
    const json = JSON.stringify(analysis, null, 2);
    await navigator.clipboard.writeText(json);
    showToast("Copied incident JSON ✅");
  };

  const deployTime = scenario?.deployment.timestamp ?? null;

  const beforeAfter = (() => {
    if (!scenario || !deployTime) return null;

    const m = scenario.metrics.filter(x => x.serviceId === scenario.deployment.serviceId);

    const p95 = m.filter(x => x.metric === "p95_latency_ms");
    const err = m.filter(x => x.metric === "error_rate");

    const p95Before = p95.filter(x => x.timestamp < deployTime).map(x => x.value);
    const p95After  = p95.filter(x => x.timestamp >= deployTime).map(x => x.value);

    const errBefore = err.filter(x => x.timestamp < deployTime).map(x => x.value);
    const errAfter  = err.filter(x => x.timestamp >= deployTime).map(x => x.value);

    return {
      p95Before: Math.round(avg(p95Before)),
      p95After:  Math.round(avg(p95After)),
      errBefore: avg(errBefore),
      errAfter:  avg(errAfter)
    };
  })();

  const spikeInfo = (() => {
    if (!scenario) return null;

    const deployTime = scenario.deployment.timestamp;
    const series = scenario.metrics
      .filter(m => m.metric === "p95_latency_ms")
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const baseline = series.filter(m => m.timestamp < deployTime).map(m => m.value);
    const baselineAvg = baseline.reduce((a, b) => a + b, 0) / Math.max(1, baseline.length);

    // Spike = first point after deploy where p95 > baselineAvg * 2
    const spike = series.find(m => m.timestamp >= deployTime && m.value > baselineAvg * 2);

    const peak = series.reduce((max, cur) => (cur.value > max.value ? cur : max), series[0]);

    return {
      baselineAvg: Math.round(baselineAvg),
      spikeAt: spike ? spike.timestamp : null,
      spikeValue: spike ? spike.value : null,
      peakAt: peak.timestamp,
      peakValue: peak.value,
    };
  })();

  return (
    <main style={{ padding: 24, background: "#0b1020", minHeight: "100vh", color: "#e6e9f2" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0 }}>ChronosOps — Latency Spike After Deployment</h1>
            <p style={{ opacity: 0.8, marginTop: 8 }}>
              Step-by-step workflow: scenario → analyze → ranked hypotheses.
            </p>
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ opacity: 0.8, fontSize: 12 }}>Scenario</span>
              <select
                value={scenarioId}
                onChange={(e) => setScenarioId(e.target.value)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.12)",
                  padding: "8px 10px",
                  borderRadius: 10,
                  outline: "none",
                }}
              >
                {scenarioList.map(s => (
                  <option key={s.scenarioId} value={s.scenarioId}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 12,
                fontWeight: 800,
                opacity: 0.95,
              }}
            >
              {apiStatus === "checking"
                ? "API: checking…"
                : apiStatus === "connected"
                ? "API: connected ✅"
                : "API: disconnected ❌"}
            </div>
            <button
              onClick={analyze}
              disabled={loading}
              style={{
                background: loading ? "#2a355e" : "#4b6bff",
                color: "white",
                border: "none",
                padding: "12px 16px",
                borderRadius: 10,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700,
              }}
            >
              {loading ? "Analyzing..." : "Analyze incident"}
            </button>
          </div>
        </header>

        {err && (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "#3a1d2b" }}>
            {err}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginTop: 16 }}>
          <div ref={scenarioRef}>
            <section style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Scenario</h2>
            {!scenario ? (
              <p style={{ opacity: 0.8 }}>Loading…</p>
            ) : (
              <div style={{ lineHeight: 1.7 }}>
                <div><b>ID:</b> {scenario.scenarioId}</div>
                <div><b>Deploy:</b> {scenario.deployment.serviceId} {scenario.deployment.versionFrom} → {scenario.deployment.versionTo}</div>
                <div><b>Time:</b> {new Date(scenario.deployment.timestamp).toLocaleString()}</div>
                <div style={{ opacity: 0.85, marginTop: 8 }}>{scenario.description}</div>
                {beforeAfter && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>BEFORE → AFTER (avg)</div>
                    <div><b>p95 latency:</b> {beforeAfter.p95Before}ms → {beforeAfter.p95After}ms</div>
                    <div><b>error rate:</b> {pct(beforeAfter.errBefore)} → {pct(beforeAfter.errAfter)}</div>
                  </div>
                )}
                {spikeInfo && (
                  <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>SPIKE DETECTION</div>
                    <div><b>Baseline avg:</b> {spikeInfo.baselineAvg}ms</div>
                    <div>
                      <b>Spike detected:</b>{" "}
                      {spikeInfo.spikeAt ? `${new Date(spikeInfo.spikeAt).toLocaleTimeString()} (${spikeInfo.spikeValue}ms)` : "Not detected"}
                    </div>
                    <div><b>Peak p95:</b> {spikeInfo.peakValue}ms at {new Date(spikeInfo.peakAt).toLocaleTimeString()}</div>
                  </div>
                )}
                {beforeAfter && spikeInfo && scenario && (
                  <TimelineRail
                    beforeLabel={`${beforeAfter.p95Before}ms`}
                    deployLabel={`${scenario.deployment.versionFrom} → ${scenario.deployment.versionTo}`}
                    spikeLabel={spikeInfo.spikeAt ? `Spike ${new Date(spikeInfo.spikeAt).toLocaleTimeString()}` : "Spike"}
                    peakLabel={`Peak ${spikeInfo.peakValue}ms`}
                    onDeployClick={() => {
                      scenarioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setHighlightTop(false);
                    }}
                    onSpikeClick={() => {
                      briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setHighlightTop(true);
                      window.setTimeout(() => setHighlightTop(false), 1800);
                    }}
                    onPeakClick={() => {
                      briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      setHighlightTop(true);
                      window.setTimeout(() => setHighlightTop(false), 1800);
                    }}
                  />
                )}
              </div>
            )}
            </section>
          </div>

          <div ref={briefRef}>
            <section style={{ padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>
              <h2 style={{ marginTop: 0, fontSize: 16 }}>Incident Brief</h2>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <button
                  onClick={copyBrief}
                  disabled={!analysis}
                  style={{
                    background: analysis ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: analysis ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Copy incident brief
                </button>
                <button
                  onClick={copyPostmortem}
                  disabled={!analysis || !scenario}
                  style={{
                    background: analysis && scenario ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: analysis && scenario ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Copy postmortem (MD)
                </button>
                <button
                  onClick={copyIncidentJson}
                  disabled={!analysis}
                  style={{
                    background: analysis ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: analysis ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  Copy incident JSON
                </button>
              </div>
            {!analysis ? (
              <p style={{ opacity: 0.8 }}>Click <b>Analyze incident</b> to generate hypotheses.</p>
            ) : (
              <>
                <div style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>INCIDENT</div>
                  <div style={{ fontWeight: 800 }}>{analysis.incidentId}</div>
                  <p style={{ marginBottom: 0 }}>{analysis.summary}</p>
                </div>

                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>EXPLAINABILITY</div>
                  <div><b>Primary signal:</b> {analysis.explainability.primarySignal}</div>
                  <div><b>Latency factor:</b> x{analysis.explainability.latencyFactor}</div>
                  <div><b>Error factor:</b> x{analysis.explainability.errorFactor}</div>
                  <div style={{ marginTop: 6, opacity: 0.9 }}>{analysis.explainability.rationale}</div>
                </div>

                <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                  <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>EVIDENCE TABLE</div>

                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: "left", opacity: 0.75 }}>
                        <th style={{ padding: "6px 8px" }}>Metric</th>
                        <th style={{ padding: "6px 8px" }}>Baseline</th>
                        <th style={{ padding: "6px 8px" }}>After</th>
                        <th style={{ padding: "6px 8px" }}>Delta</th>
                        <th style={{ padding: "6px 8px" }}>Factor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.evidenceTable.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                          <td style={{ padding: "6px 8px" }}>
                            {r.metric === "p95_latency_ms" ? "p95 latency (ms)" : "error rate"}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {r.metric === "p95_latency_ms" ? `${Math.round(r.baselineAvg)}ms` : `${(r.baselineAvg * 100).toFixed(2)}%`}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {r.metric === "p95_latency_ms" ? `${Math.round(r.afterAvg)}ms` : `${(r.afterAvg * 100).toFixed(2)}%`}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            {r.metric === "p95_latency_ms"
                              ? `${r.delta >= 0 ? "+" : ""}${Math.round(r.delta)}ms`
                              : `${r.delta >= 0 ? "+" : ""}${(r.delta * 100).toFixed(2)}%`}
                          </td>
                          <td style={{ padding: "6px 8px" }}>x{r.factor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <RunbookPanel primarySignal={analysis.explainability.primarySignal} />

                {scenario && <DemoScript scenarioTitle={scenario.title} />}

                <h3 style={{ marginTop: 12, fontSize: 14 }}>Top hypotheses</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {analysis.likelyRootCauses.map((rc) => (
                    <div
                      key={rc.rank}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        background: "rgba(0,0,0,0.25)",
                        outline:
                          highlightTop && rc.rank === 1 ? "2px solid rgba(75,107,255,0.9)" : "none",
                        boxShadow:
                          highlightTop && rc.rank === 1 ? "0 0 0 6px rgba(75,107,255,0.15)" : "none",
                        transition: "all 180ms ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>#{rc.rank} — {rc.title}</div>
                        <div style={{ opacity: 0.85 }}>Confidence: <b>{Math.round(rc.confidence * 100)}%</b></div>
                      </div>

                      {rc.evidence.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {rc.evidence.map((ev, i) => (
                            <span key={i} style={chipStyle}>
                              {ev.type.toUpperCase()}: {(ev.key ?? ev.span ?? ev.pattern ?? ev.route) ?? "evidence"} {ev.delta ? `(${ev.delta})` : ""}
                            </span>
                          ))}
                        </div>
                      )}

                      {rc.nextActions.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>NEXT ACTIONS</div>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                            {rc.nextActions.map((a, idx) => <li key={idx}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <h3 style={{ marginTop: 12, fontSize: 14 }}>Blast radius</h3>
                <div style={{ padding: 12, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
                  <div><b>Services:</b> {analysis.blastRadius.impactedServices.join(", ")}</div>
                  <div><b>Routes:</b> {analysis.blastRadius.impactedRoutes.join(", ")}</div>
                  <div><b>Impact:</b> {analysis.blastRadius.userImpact}</div>
                </div>
              </>
            )}
            </section>
          </div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            right: 18,
            bottom: 18,
            padding: "10px 12px",
            borderRadius: 12,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "white",
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            zIndex: 9999,
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}

function TimelineRail({
  beforeLabel,
  deployLabel,
  spikeLabel,
  peakLabel,
  onDeployClick,
  onSpikeClick,
  onPeakClick,
}: {
  beforeLabel: string;
  deployLabel: string;
  spikeLabel: string;
  peakLabel: string;
  onDeployClick: () => void;
  onSpikeClick: () => void;
  onPeakClick: () => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ opacity: 0.7, fontSize: 12, marginBottom: 8 }}>TIMELINE</div>

      <div style={{ position: "relative", height: 58, borderRadius: 12, background: "rgba(0,0,0,0.25)" }}>
        {/* rail */}
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 14,
            top: "50%",
            height: 2,
            transform: "translateY(-50%)",
            background: "rgba(255,255,255,0.14)",
          }}
        />

        {/* markers */}
        <Marker left="14px" label={beforeLabel} variant="ok" />
        <Marker left="45%" label={deployLabel} variant="deploy" onClick={onDeployClick} />
        <Marker left="70%" label={spikeLabel} variant="warn" onClick={onSpikeClick} />
        <Marker left="calc(100% - 14px)" label={peakLabel} variant="bad" onClick={onPeakClick} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          opacity: 0.75,
          fontSize: 12,
        }}
      >
        <span>Before</span>
        <span>Deploy</span>
        <span>Spike</span>
        <span>Peak</span>
      </div>
    </div>
  );
}

function Marker({
  left,
  label,
  variant,
  onClick,
}: {
  left: string;
  label: string;
  variant: "ok" | "deploy" | "warn" | "bad";
  onClick?: () => void;
}) {
  const bg =
    variant === "deploy"
      ? "rgba(75,107,255,0.95)"
      : variant === "bad"
      ? "rgba(255,92,92,0.9)"
      : variant === "warn"
      ? "rgba(255,196,92,0.95)"
      : "rgba(72,200,140,0.9)";

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left,
        top: "50%",
        transform: "translate(-50%,-50%)",
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: bg,
          boxShadow: "0 0 0 4px rgba(255,255,255,0.06)",
          transform: onClick ? "scale(1.05)" : "scale(1)",
        }}
      />
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.9, whiteSpace: "nowrap", textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}

function RunbookPanel({ primarySignal }: { primarySignal: "latency" | "errors" }) {
  const isLatency = primarySignal === "latency";

  const immediate = isLatency
    ? [
        "Rollback to last known good version",
        "Disable any newly enabled feature flag / expensive path",
        "Reduce load temporarily (rate limit, shed non-critical traffic)",
      ]
    : [
        "Rollback the config change immediately",
        "Verify secrets/env vars are correct and present",
        "Temporarily bypass failing upstream if possible (fallback / degraded mode)",
      ];

  const verify = isLatency
    ? [
        "p95/p99 latency returns to baseline within 5–10 minutes",
        "DB latency / connection pool saturation normalizes",
        "Error rate does not increase during rollback",
      ]
    : [
        "Error rate drops to baseline (watch 401/403 vs 5xx breakdown)",
        "Auth success rate recovers",
        "No new spikes in latency due to retries/backoff loops",
      ];

  const escalate = isLatency
    ? [
        "Engage DB/platform team if DB latency remains high after rollback",
        "Open an incident bridge if customer impact exceeds SLO burn rate",
      ]
    : [
        "Engage platform/identity owner if errors are auth-related",
        "Engage upstream dependency owner if errors are 5xx from downstream",
      ];

  return (
    <div style={{ marginTop: 12, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>Runbook Actions</h3>

      <Section title="Immediate mitigations" items={immediate} />
      <Section title="Verify recovery" items={verify} />
      <Section title="Escalate if needed" items={escalate} />

      <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
        Tip: In enterprise mode, this panel can be generated from service-owned runbooks + linked tickets.
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ opacity: 0.7, fontSize: 12 }}>{title.toUpperCase()}</div>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function DemoScript({ scenarioTitle }: { scenarioTitle: string }) {
  return (
    <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: "rgba(255,255,255,0.06)" }}>
      <h3 style={{ marginTop: 0, fontSize: 14 }}>Demo Script (2 minutes)</h3>

      <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
        <li>
          <b>Select scenario:</b> "{scenarioTitle}" — show the deployment and timeline rail.
        </li>
        <li>
          <b>Point to evidence:</b> "Before → After" deltas and Spike/Peak markers (ground truth telemetry).
        </li>
        <li>
          <b>Click Analyze:</b> ChronosOps generates ranked root-cause hypotheses.
        </li>
        <li>
          <b>Explainability:</b> show primary signal + factors + rationale (why this hypothesis).
        </li>
        <li>
          <b>Evidence table:</b> baseline vs after numbers (postmortem-grade).
        </li>
        <li>
          <b>Runbook:</b> immediate mitigations + verify + escalate (actionable, not just insights).
        </li>
        <li>
          <b>Exports:</b> copy postmortem (MD) and JSON (ready for Jira/Slack/SIEM).
        </li>
      </ol>

      <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
        One-line pitch: <b>"ChronosOps turns deployments + telemetry into explainable root-cause hypotheses and ready-to-share postmortems."</b>
      </div>
    </div>
  );
}

const chipStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
};
