import { EvidenceRequestSchema, type EvidenceRequest } from "@chronosops/contracts";
import { isSafeMode } from "../policy/safe-mode";

export interface RejectedRequest {
  request: EvidenceRequest;
  reason: string;
  code?: string; // Explicit rejection code for audit
}

export interface PolicyResult {
  approvedRequests: EvidenceRequest[];
  rejectedRequests: RejectedRequest[];
}

/**
 * Policy gate for model evidence requests.
 * Enforces:
 * - Allowlist of evidence needs
 * - Time window bounds (within session window, stricter in safe mode)
 * - Max items cap per evidence type (stricter in safe mode)
 * - Deduplication by need (keep highest priority)
 * - Per-iteration limits (stricter in safe mode)
 */
export function applyEvidenceRequestPolicy(
  requests: EvidenceRequest[],
  sessionWindow: { start: string; end: string },
  maxWindowHours?: number // Auto-determined from safe mode if not provided
): PolicyResult {
  const safeMode = isSafeMode();
  
  // Set bounds based on safe mode
  const effectiveMaxWindowHours = maxWindowHours ?? (safeMode ? 2 : 6);
  const effectiveMaxItems = safeMode ? 50 : 200;
  const effectiveMaxPerIteration = safeMode ? 1 : 2;
  const approvedRequests: EvidenceRequest[] = [];
  const rejectedRequests: RejectedRequest[] = [];

  // Allowlist
  const allowedNeeds = new Set(["METRICS", "LOGS", "TRACES", "DEPLOYS", "CONFIG", "GOOGLE_STATUS"]);

  // Parse session window
  const sessionStart = new Date(sessionWindow.start);
  const sessionEnd = new Date(sessionWindow.end);
  const maxWindowMs = effectiveMaxWindowHours * 60 * 60 * 1000;

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
        code: "NEED_NOT_ALLOWED",
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
          code: "WINDOW_OUT_OF_BOUNDS",
        });
        continue;
      }

      // Check max window size
      const windowMs = reqEnd.getTime() - reqStart.getTime();
      if (windowMs > maxWindowMs) {
        rejectedRequests.push({
          request,
          reason: `Time window exceeds maximum ${effectiveMaxWindowHours} hours (${safeMode ? 'safe mode' : 'normal mode'})`,
          code: "WINDOW_TOO_LARGE",
        });
        continue;
      }

      // Check valid date range
      if (reqStart >= reqEnd) {
        rejectedRequests.push({
          request,
          reason: `Invalid time window: start must be before end`,
          code: "INVALID_WINDOW",
        });
        continue;
      }
    }

    // Validate maxItems if provided
    if (request.scope?.maxItems !== undefined) {
      if (request.scope.maxItems < 1 || request.scope.maxItems > effectiveMaxItems) {
        rejectedRequests.push({
          request,
          reason: `maxItems must be between 1 and ${effectiveMaxItems} (${safeMode ? 'safe mode' : 'normal mode'}), got ${request.scope.maxItems}`,
          code: "MAX_ITEMS_TOO_HIGH",
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
  const deduplicated = Array.from(needMap.values());
  
  // Apply per-iteration limit
  if (deduplicated.length > effectiveMaxPerIteration) {
    // Sort by priority and take top N
    const sorted = deduplicated.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
    approvedRequests.push(...sorted.slice(0, effectiveMaxPerIteration));
    
    // Reject the rest
    for (const req of sorted.slice(effectiveMaxPerIteration)) {
      rejectedRequests.push({
        request: req,
        reason: `Per-iteration limit exceeded: max ${effectiveMaxPerIteration} evidence types allowed (${safeMode ? 'safe mode' : 'normal mode'})`,
        code: "PER_ITERATION_LIMIT_EXCEEDED",
      });
    }
  } else {
    approvedRequests.push(...deduplicated);
  }

  return {
    approvedRequests,
    rejectedRequests,
  };
}
