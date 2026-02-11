import { Injectable } from "@nestjs/common";
import { LogsSummarySchema } from "@chronosops/contracts";
import { logSignature } from "./signature";

type RawLog = {
  ts: string;
  severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL" | "UNKNOWN";
  message: string;
  service?: string | null;
  attributes?: Record<string, string> | null;
};

@Injectable()
export class LogsNormalizer {
  /**
   * Normalize raw logs into LogsSummary
   * Deterministic: groups by signature, creates bounded exemplars
   */
  normalizeToSummary(input: {
    window: { start: string; end: string };
    logs: RawLog[];
    mode: "REAL" | "STUB";
    notes: string[];
  }): ReturnType<typeof LogsSummarySchema.parse> {
    const logs = input.logs;
    
    // Compute totals
    const totals = {
      lines: logs.length,
      errorLines: logs.filter(l => l.severity === "ERROR" || l.severity === "CRITICAL").length,
      warnLines: logs.filter(l => l.severity === "WARN").length,
    };

    // Group by signature
    const groupsMap = new Map<string, {
      signature: string;
      logs: RawLog[];
      firstSeen: string;
      lastSeen: string;
    }>();

    for (const log of logs) {
      const sig = logSignature(log.message);
      const existing = groupsMap.get(sig);
      
      if (existing) {
        existing.logs.push(log);
        if (log.ts < existing.firstSeen) existing.firstSeen = log.ts;
        if (log.ts > existing.lastSeen) existing.lastSeen = log.ts;
      } else {
        groupsMap.set(sig, {
          signature: sig,
          logs: [log],
          firstSeen: log.ts,
          lastSeen: log.ts,
        });
      }
    }

    // Convert to groups and sort by priority:
    // 1. Error severity first
    // 2. Then count desc
    // 3. Then most recent
    const groups = Array.from(groupsMap.values())
      .map(g => {
        const errorCount = g.logs.filter(l => l.severity === "ERROR" || l.severity === "CRITICAL").length;
        const hasErrors = errorCount > 0;
        return {
          ...g,
          count: g.logs.length,
          errorCount,
          hasErrors,
          mostRecent: g.lastSeen,
        };
      })
      .sort((a, b) => {
        // Errors first
        if (a.hasErrors !== b.hasErrors) return b.hasErrors ? 1 : -1;
        // Then by count
        if (a.count !== b.count) return b.count - a.count;
        // Then by most recent
        return b.mostRecent.localeCompare(a.mostRecent);
      })
      .slice(0, 50); // Bound to max 50 groups

    // Build exemplars (max 200)
    const exemplarMap = new Map<string, {
      id: string;
      ts: string;
      severity: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL" | "UNKNOWN";
      service?: string | null;
      message: string;
      attributes: Record<string, string>;
    }>();

    // Collect exemplars from top groups (prioritize errors)
    for (const group of groups) {
      // Sort group logs: errors first, then by timestamp
      const sortedLogs = [...group.logs].sort((a, b) => {
        const aIsError = a.severity === "ERROR" || a.severity === "CRITICAL";
        const bIsError = b.severity === "ERROR" || b.severity === "CRITICAL";
        if (aIsError !== bIsError) return bIsError ? 1 : -1;
        return b.ts.localeCompare(a.ts); // Most recent first
      });

      // Take up to 10 exemplars per group
      for (const log of sortedLogs.slice(0, 10)) {
        if (exemplarMap.size >= 200) break;
        const exemplarId = `log-${log.ts}-${exemplarMap.size}`;
        exemplarMap.set(exemplarId, {
          id: exemplarId,
          ts: log.ts,
          severity: log.severity,
          service: log.service ?? null,
          message: log.message.slice(0, 1000),
          attributes: log.attributes || {},
        });
      }
      if (exemplarMap.size >= 200) break;
    }

    const exemplars = Array.from(exemplarMap.values());

    // Build topGroups with exemplarIds
    const topGroups = groups.map(g => {
      const exemplarIds: string[] = [];
      const sig = g.signature;
      
      // Find exemplars that match this signature
      for (const ex of exemplars) {
        if (exemplarIds.length >= 10) break;
        if (logSignature(ex.message) === sig) {
          exemplarIds.push(ex.id);
        }
      }

      return {
        signature: g.signature,
        count: g.count,
        firstSeen: g.firstSeen,
        lastSeen: g.lastSeen,
        exemplarIds: exemplarIds.slice(0, 10),
      };
    });

    const summary = {
      kind: "LOGS_SUMMARY_V1" as const,
      window: {
        start: input.window.start,
        end: input.window.end,
      },
      totals,
      topGroups,
      exemplars,
      completeness: {
        mode: input.mode,
        notes: input.notes,
      },
    };

    return LogsSummarySchema.parse(summary);
  }
}
