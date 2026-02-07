import { Injectable } from "@nestjs/common";
import type { DeployEvent } from "@chronosops/contracts";

@Injectable()
export class DeploysClient {
  isRealMode(): boolean {
    const mode = process.env.CHRONOSOPS_DEPLOYS_MODE;
    
    // Explicit mode override
    if (mode === "STUB") return false;
    if (mode === "REAL") {
      // REAL mode requires at least one integration
      const hasGithub = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
      const hasGcp = Boolean(process.env.GCP_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS);
      return hasGithub || hasGcp;
    }
    
    // AUTO mode: try to detect
    const hasGithub = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
    const hasGcp = Boolean(process.env.GCP_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS);
    return hasGithub || hasGcp;
  }

  async fetchDeployEvents(_args: {
    start: string;
    end: string;
    service?: string | null;
  }): Promise<{ mode: "REAL" | "STUB"; events: DeployEvent[]; notes: string[] }> {
    if (!this.isRealMode()) {
      // STUB mode: generate deterministic events based on window + service
      const start = new Date(_args.start);
      const end = new Date(_args.end);
      const windowMs = end.getTime() - start.getTime();
      const midpoint = new Date(start.getTime() + windowMs / 2);
      
      // Generate 1-3 deterministic stub events
      const stubEvents: DeployEvent[] = [];
      
      // Event 1: Near midpoint (most likely deployment time)
      stubEvents.push({
        id: `stub-deploy-${midpoint.getTime()}`,
        ts: midpoint.toISOString(),
        system: "UNKNOWN",
        service: _args.service ?? null,
        environment: "production",
        version: "v1.0.0",
        commitSha: null,
        actor: "system",
        description: "Stub deployment event (REAL mode not configured)",
        url: null,
      });
      
      return {
        mode: "STUB",
        events: stubEvents,
        notes: ["CHRONOSOPS_DEPLOYS_MODE=STUB or missing integration credentials; returning stub deployment events."],
      };
    }

    // REAL implementation
    // TODO: Implement real GitHub/Cloud Build API calls
    // For Day 08, we'll return STUB mode with a note
    return {
      mode: "REAL",
      events: [],
      notes: ["REAL mode not fully implemented yet (Day 08 - placeholder)"],
    };
  }
}
