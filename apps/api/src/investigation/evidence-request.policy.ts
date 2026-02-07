import { EvidenceRequestSchema, type EvidenceRequest } from "@chronosops/contracts";

export interface PolicyResult {
  approvedRequests: EvidenceRequest[];
  rejectedRequests: Array<{
    request: EvidenceRequest;
    reason: string;
  }>;
}

/**
 * Policy gate for model evidence requests.
 * Enforces:
 * - Allowlist of evidence needs
 * - Time window bounds (within session window, max 6 hours)
 * - Max items cap per evidence type
 * - Deduplication by need (keep highest priority)
 */
export function applyEvidenceRequestPolicy(
  requests: EvidenceRequest[],
  sessionWindow: { start: string; end: string },
  maxWindowHours: number = 6
): PolicyResult {
  const approvedRequests: EvidenceRequest[] = [];
  const rejectedRequests: Array<{ request: EvidenceRequest; reason: string }> = [];

  // Allowlist
  const allowedNeeds = new Set(["METRICS", "LOGS", "TRACES", "DEPLOYS", "CONFIG", "GOOGLE_STATUS"]);

  // Parse session window
  const sessionStart = new Date(sessionWindow.start);
  const sessionEnd = new Date(sessionWindow.end);
  const maxWindowMs = maxWindowHours * 60 * 60 * 1000;

  // Validate and deduplicate by need (keep highest priority)
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  const needMap = new Map<string, EvidenceRequest>();

  for (const rawRequest of requests) {
    // Parse and validate schema
    const parseResult = EvidenceRequestSchema.safeParse(rawRequest);
    if (!parseResult.success) {
      rejectedRequests.push({
        request: rawRequest,
        reason: `Invalid schema: ${parseResult.error.message}`,
      });
      continue;
    }

    const request = parseResult.data;

    // Check allowlist
    if (!allowedNeeds.has(request.need)) {
      rejectedRequests.push({
        request,
        reason: `Need '${request.need}' not in allowlist`,
      });
      continue;
    }

    // Validate time window if provided
    if (request.scope?.windowStart || request.scope?.windowEnd) {
      const reqStart = request.scope.windowStart ? new Date(request.scope.windowStart) : sessionStart;
      const reqEnd = request.scope.windowEnd ? new Date(request.scope.windowEnd) : sessionEnd;

      // Check if within session window
      if (reqStart < sessionStart || reqEnd > sessionEnd) {
        rejectedRequests.push({
          request,
          reason: `Time window outside session bounds: ${reqStart.toISOString()} to ${reqEnd.toISOString()}`,
        });
        continue;
      }

      // Check max window size
      const windowMs = reqEnd.getTime() - reqStart.getTime();
      if (windowMs > maxWindowMs) {
        rejectedRequests.push({
          request,
          reason: `Time window exceeds maximum ${maxWindowHours} hours`,
        });
        continue;
      }

      // Check valid date range
      if (reqStart >= reqEnd) {
        rejectedRequests.push({
          request,
          reason: `Invalid time window: start must be before end`,
        });
        continue;
      }
    }

    // Validate maxItems if provided
    if (request.scope?.maxItems !== undefined) {
      if (request.scope.maxItems < 1 || request.scope.maxItems > 200) {
        rejectedRequests.push({
          request,
          reason: `maxItems must be between 1 and 200, got ${request.scope.maxItems}`,
        });
        continue;
      }
    }

    // Deduplicate by need - keep highest priority
    const existing = needMap.get(request.need);
    if (!existing || priorityRank[request.priority] < priorityRank[existing.priority]) {
      needMap.set(request.need, request);
    }
  }

  // Add approved requests (deduplicated)
  approvedRequests.push(...Array.from(needMap.values()));

  return {
    approvedRequests,
    rejectedRequests,
  };
}
