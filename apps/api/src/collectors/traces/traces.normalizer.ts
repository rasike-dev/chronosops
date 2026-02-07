import { Injectable } from "@nestjs/common";
import { TracesSummarySchema } from "@chronosops/contracts";
import { traceSignature } from "./signature";

type RawSpan = {
  ts: string;
  service?: string | null;
  operation: string;
  durationMs: number;
  status: "OK" | "ERROR" | "UNSET";
  attributes?: Record<string, string> | null;
};

@Injectable()
export class TracesNormalizer {
  /**
   * Normalize raw spans into TracesSummary
   * Deterministic: groups by signature, computes percentiles, creates bounded exemplars
   */
  normalizeToSummary(input: {
    window: { start: string; end: string };
    spans: RawSpan[];
    mode: "REAL" | "STUB";
    notes: string[];
  }): ReturnType<typeof TracesSummarySchema.parse> {
    const spans = input.spans;
    
    // Compute totals
    const totals = {
      spans: spans.length,
      errorSpans: spans.filter(s => s.status === "ERROR").length,
    };

    // Group by signature
    const groupsMap = new Map<string, {
      signature: string;
      spans: RawSpan[];
    }>();

    for (const span of spans) {
      const sig = traceSignature({
        service: span.service,
        operation: span.operation,
        status: span.status,
      });
      
      const existing = groupsMap.get(sig);
      if (existing) {
        existing.spans.push(span);
      } else {
        groupsMap.set(sig, {
          signature: sig,
          spans: [span],
        });
      }
    }

    // Convert to groups and compute percentiles
    const groups = Array.from(groupsMap.values())
      .map(g => {
        // Sort durations for percentile calculation
        const durations = g.spans.map(s => s.durationMs).sort((a, b) => a - b);
        const count = durations.length;
        
        // Compute percentiles deterministically
        const p50Index = Math.floor(count * 0.5);
        const p95Index = Math.floor(count * 0.95);
        const p50Ms = count > 0 ? durations[p50Index] : 0;
        const p95Ms = count > 0 ? durations[p95Index] : 0;
        const maxMs = count > 0 ? Math.max(...durations) : 0;
        
        // Count errors
        const errorCount = g.spans.filter(s => s.status === "ERROR").length;
        
        return {
          ...g,
          count,
          p50Ms,
          p95Ms,
          maxMs,
          errorCount,
        };
      })
      .sort((a, b) => {
        // Errors first
        if (a.errorCount !== b.errorCount) return b.errorCount - a.errorCount;
        // Then by count
        if (a.count !== b.count) return b.count - a.count;
        // Then by p95 latency (highest first)
        return b.p95Ms - a.p95Ms;
      })
      .slice(0, 50); // Bound to max 50 groups

    // Build exemplars (max 200)
    const exemplarMap = new Map<string, {
      id: string;
      ts: string;
      service?: string | null;
      operation: string;
      durationMs: number;
      status: "OK" | "ERROR" | "UNSET";
      attributes: Record<string, string>;
    }>();

    // Collect exemplars from top groups (prioritize errors and high latency)
    for (const group of groups) {
      // Sort group spans: errors first, then by duration (highest first)
      const sortedSpans = [...group.spans].sort((a, b) => {
        if (a.status === "ERROR" && b.status !== "ERROR") return -1;
        if (a.status !== "ERROR" && b.status === "ERROR") return 1;
        return b.durationMs - a.durationMs; // Highest duration first
      });

      // Take up to 10 exemplars per group
      for (const span of sortedSpans.slice(0, 10)) {
        if (exemplarMap.size >= 200) break;
        const exemplarId = `trace-${span.ts}-${exemplarMap.size}`;
        exemplarMap.set(exemplarId, {
          id: exemplarId,
          ts: span.ts,
          service: span.service ?? null,
          operation: span.operation.slice(0, 200),
          durationMs: span.durationMs,
          status: span.status,
          attributes: span.attributes || {},
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
        const exSig = traceSignature({
          service: ex.service,
          operation: ex.operation,
          status: ex.status,
        });
        if (exSig === sig) {
          exemplarIds.push(ex.id);
        }
      }

      return {
        signature: g.signature,
        count: g.count,
        p50Ms: Number(g.p50Ms.toFixed(2)),
        p95Ms: Number(g.p95Ms.toFixed(2)),
        maxMs: Number(g.maxMs.toFixed(2)),
        exemplarIds: exemplarIds.slice(0, 10),
      };
    });

    const summary = {
      kind: "TRACES_SUMMARY_V1" as const,
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

    return TracesSummarySchema.parse(summary);
  }
}
