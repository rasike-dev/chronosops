import { Injectable } from "@nestjs/common";

type RawSpan = {
  ts: string;
  service?: string | null;
  operation: string;
  durationMs: number;
  status: "OK" | "ERROR" | "UNSET";
  attributes?: Record<string, string> | null;
};

@Injectable()
export class TracesClient {
  isRealMode(): boolean {
    const mode = process.env.CHRONOSOPS_TRACES_MODE;
    
    // Explicit mode override
    if (mode === "STUB") return false;
    if (mode === "REAL") {
      // REAL mode requires integration credentials
      const hasGcp = Boolean(process.env.GCP_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS);
      return hasGcp;
    }
    
    // AUTO mode: try to detect
    const hasGcp = Boolean(process.env.GCP_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS);
    return hasGcp;
  }

  async fetchSpans(_args: {
    start: string;
    end: string;
    service?: string | null;
    hints?: string[];
  }): Promise<{ mode: "REAL" | "STUB"; spans: RawSpan[]; notes: string[] }> {
    if (!this.isRealMode()) {
      // STUB mode: generate deterministic spans with durations skewed by incident hints
      const start = new Date(_args.start);
      const end = new Date(_args.end);
      const windowMs = end.getTime() - start.getTime();
      const numSpans = Math.min(Math.max(20, Math.floor(windowMs / 30000)), 80); // 20-80 spans
      
      const stubSpans: RawSpan[] = [];
      const serviceName = _args.service || "unknown-service";
      
      // Check hints for latency vs errors
      const hasLatencyHint = _args.hints?.some(h => h.includes("latency") || h.includes("slow"));
      const hasErrorHint = _args.hints?.some(h => h.includes("error") || h.includes("fail"));
      
      // Generate deterministic spans
      for (let i = 0; i < numSpans; i++) {
        const ts = new Date(start.getTime() + (windowMs * i) / numSpans).toISOString();
        
        // Skew durations based on hints
        let baseDuration = 50 + (i % 10) * 10; // 50-140ms baseline
        if (hasLatencyHint) {
          baseDuration *= 2.5; // Increase latency for latency incidents
        }
        
        // Skew error rate based on hints
        const isError = hasErrorHint && (i % 5 === 0); // 20% error rate if error hint
        const status: "OK" | "ERROR" = isError ? "ERROR" : "OK";
        
        const operations = [
          "GET /api/v1/users",
          "POST /api/v1/auth/login",
          "GET /api/v1/incidents",
          "POST /api/v1/incidents/analyze",
          "GET /api/v1/health",
        ];
        const operation = operations[i % operations.length];
        
        stubSpans.push({
          ts,
          service: serviceName,
          operation,
          durationMs: Math.round(baseDuration),
          status,
          attributes: {
            httpMethod: operation.split(" ")[0],
            httpRoute: operation.split(" ")[1],
            traceId: `<uuid>`,
          },
        });
      }
      
      return {
        mode: "STUB",
        spans: stubSpans,
        notes: ["CHRONOSOPS_TRACES_MODE=STUB or missing integration credentials; returning stub traces."],
      };
    }

    // REAL implementation
    // TODO: Implement real Cloud Trace / OTEL backend calls
    return {
      mode: "REAL",
      spans: [],
      notes: ["REAL mode not fully implemented yet (Day 09 - placeholder)"],
    };
  }
}
