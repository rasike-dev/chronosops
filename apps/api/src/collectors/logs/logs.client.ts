import { Injectable } from "@nestjs/common";

type RawLog = {
  ts: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL" | "UNKNOWN";
  message: string;
  service?: string | null;
  attributes?: Record<string, string> | null;
};

@Injectable()
export class LogsClient {
  isRealMode(): boolean {
    const mode = process.env.CHRONOSOPS_LOGS_MODE;
    
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

  async fetchLogs(_args: {
    start: string;
    end: string;
    service?: string | null;
  }): Promise<{ mode: "REAL" | "STUB"; logs: RawLog[]; notes: string[] }> {
    if (!this.isRealMode()) {
      // STUB mode: generate deterministic logs based on window + service
      const start = new Date(_args.start);
      const end = new Date(_args.end);
      const windowMs = end.getTime() - start.getTime();
      const numLogs = Math.min(Math.max(30, Math.floor(windowMs / 60000)), 100); // 30-100 logs
      
      const stubLogs: RawLog[] = [];
      const serviceName = _args.service || "unknown-service";
      
      // Generate deterministic logs
      for (let i = 0; i < numLogs; i++) {
        const ts = new Date(start.getTime() + (windowMs * i) / numLogs).toISOString();
        const severityIndex = i % 5;
        const severities: Array<"DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL"> = [
          "INFO", "INFO", "WARN", "ERROR", "ERROR"
        ];
        const severity = severities[severityIndex];
        
        const messages = [
          `Request processed successfully for user <num>`,
          `Database query completed in <num>ms`,
          `Cache miss for key <token>`,
          `Error processing request: connection timeout`,
          `Failed to authenticate user <uuid>`,
          `Service ${serviceName} health check passed`,
          `Rate limit exceeded for IP <hex>`,
        ];
        const message = messages[i % messages.length];
        
        stubLogs.push({
          ts,
          severity,
          message,
          service: serviceName,
          attributes: {
            requestId: `<uuid>`,
            userId: `<num>`,
          },
        });
      }
      
      return {
        mode: "STUB",
        logs: stubLogs,
        notes: ["CHRONOSOPS_LOGS_MODE=STUB or missing integration credentials; returning stub logs."],
      };
    }

    // REAL implementation
    // TODO: Implement real Google Cloud Logging API calls
    return {
      mode: "REAL",
      logs: [],
      notes: ["REAL mode not fully implemented yet (Day 09 - placeholder)"],
    };
  }
}
