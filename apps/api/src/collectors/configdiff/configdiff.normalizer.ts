import { Injectable } from "@nestjs/common";
import { ConfigDiffSummarySchema } from "@chronosops/contracts";
import type { ConfigDiffItem } from "@chronosops/contracts";

@Injectable()
export class ConfigDiffNormalizer {
  /**
   * Normalize config diffs into ConfigDiffSummary
   * Deterministic: sorts by key, bounds to max 500 diffs
   */
  normalizeToSummary(input: {
    window: { start: string; end: string };
    diffs: ConfigDiffItem[];
    service?: string | null;
    environment?: string | null;
    mode: "REAL" | "STUB";
    notes: string[];
  }): ReturnType<typeof ConfigDiffSummarySchema.parse> {
    // Sort diffs by key (ascending)
    const sortedDiffs = [...input.diffs]
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(0, 500); // Bound to max 500

    const summary = {
      kind: "CONFIG_DIFF_SUMMARY_V1" as const,
      scope: {
        service: input.service ?? null,
        environment: input.environment ?? null,
      },
      window: {
        start: input.window.start,
        end: input.window.end,
      },
      diffs: sortedDiffs,
      completeness: {
        mode: input.mode,
        notes: input.notes,
      },
    };

    return ConfigDiffSummarySchema.parse(summary);
  }
}
