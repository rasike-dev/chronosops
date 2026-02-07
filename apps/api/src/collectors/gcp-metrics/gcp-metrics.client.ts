import { Injectable } from "@nestjs/common";

@Injectable()
export class GcpMetricsClient {
  isRealMode(): boolean {
    const project = process.env.GCP_PROJECT_ID;
    const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const mode = process.env.CHRONOSOPS_GCP_METRICS_MODE;
    
    // Explicit mode override
    if (mode === "STUB") return false;
    if (mode === "REAL") return Boolean(project && creds);
    
    // Auto-detect: real mode if both project and creds are present
    return Boolean(project && creds);
  }

  async fetchTimeSeries(_args: {
    metricType: string;
    start: string;
    end: string;
    alignmentPeriodSeconds: number;
    filterExtras?: string[];
  }): Promise<{ mode: "REAL" | "STUB"; points: { ts: string; value: number }[]; notes: string[] }> {
    if (!this.isRealMode()) {
      return {
        mode: "STUB",
        points: [],
        notes: ["GCP_PROJECT_ID/GOOGLE_APPLICATION_CREDENTIALS not configured; returning stub metrics."],
      };
    }

    // REAL implementation using @google-cloud/monitoring
    // Keep it minimal; we'll harden later.
    // (Use alignment + per-series aligner, then normalize to points[])
    // TODO: Implement real GCP Monitoring API calls
    // For Day 07, we'll return STUB mode with a note
    return {
      mode: "REAL",
      points: [],
      notes: ["REAL mode not fully implemented yet (Day 07 - placeholder)"],
    };
  }
}
