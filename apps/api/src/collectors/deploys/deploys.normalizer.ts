import { Injectable } from "@nestjs/common";
import { DeploysSummarySchema } from "@chronosops/contracts";
import type { DeployEvent } from "@chronosops/contracts";

@Injectable()
export class DeploysNormalizer {
  /**
   * Normalize deploy events into DeploysSummary
   * Deterministic: sorts by timestamp, bounds to max 200 events
   */
  normalizeToSummary(input: {
    window: { start: string; end: string };
    events: DeployEvent[];
    mode: "REAL" | "STUB";
    notes: string[];
  }): ReturnType<typeof DeploysSummarySchema.parse> {
    // Sort events by timestamp (ascending)
    const sortedEvents = [...input.events]
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .slice(0, 200); // Bound to max 200

    const summary = {
      kind: "DEPLOYS_SUMMARY_V1" as const,
      window: {
        start: input.window.start,
        end: input.window.end,
      },
      deploys: sortedEvents,
      completeness: {
        mode: input.mode,
        notes: input.notes,
      },
    };

    return DeploysSummarySchema.parse(summary);
  }
}
