import { isSafeMode } from "./safe-mode";

export type CollectorMode = "STUB" | "REAL";

export interface CollectorPolicyDecision {
  allowed: boolean;
  forcedMode?: CollectorMode;
  reason: string;
}

/**
 * Evidence type to environment variable mapping for REAL mode allowlist
 */
const REAL_MODE_ALLOWLIST: Record<string, string> = {
  "GCP_METRICS": "CHRONOSOPS_ALLOW_REAL_GCP_METRICS",
  "GCP_LOGS": "CHRONOSOPS_ALLOW_REAL_GCP_LOGS",
  "GCP_TRACES": "CHRONOSOPS_ALLOW_REAL_GCP_TRACES",
  "DEPLOYS": "CHRONOSOPS_ALLOW_REAL_DEPLOYS",
  "CONFIG": "CHRONOSOPS_ALLOW_REAL_CONFIG",
};

/**
 * Default allowed evidence types in safe mode (STUB only)
 */
const SAFE_MODE_STUB_ALLOWLIST = new Set([
  "METRICS_SUMMARY",
  "DEPLOYS_SUMMARY",
  "CONFIG_DIFF_SUMMARY",
  "LOGS_SUMMARY",
  "TRACES_SUMMARY",
]);

/**
 * Checks if a collector is allowed to run and what mode it should use.
 * 
 * Rules:
 * - In safe mode: only STUB mode allowed unless explicitly allowlisted for REAL
 * - In normal mode: REAL mode allowed if explicitly allowlisted
 * - Evidence types must be in the allowlist
 */
export function checkCollectorPolicy(
  evidenceType: string,
  requestedMode: CollectorMode = "REAL"
): CollectorPolicyDecision {
  const safeMode = isSafeMode();

  // Check if evidence type is in safe mode stub allowlist
  const isStubAllowed = SAFE_MODE_STUB_ALLOWLIST.has(evidenceType);

  if (safeMode) {
    // Safe mode: only STUB allowed unless explicitly allowlisted for REAL
    if (requestedMode === "REAL") {
      // Check if REAL mode is explicitly allowed for this evidence type
      const allowVar = REAL_MODE_ALLOWLIST[evidenceType];
      if (allowVar) {
        const isRealAllowed = process.env[allowVar] === "true";
        if (isRealAllowed) {
          return {
            allowed: true,
            forcedMode: undefined, // Can use REAL
            reason: `REAL mode explicitly allowed via ${allowVar}`,
          };
        }
      }

      // REAL mode not allowed in safe mode
      if (isStubAllowed) {
        return {
          allowed: true,
          forcedMode: "STUB",
          reason: "SAFE_MODE_REAL_BLOCKED: Safe mode forces STUB, REAL not allowlisted",
        };
      } else {
        return {
          allowed: false,
          reason: "SAFE_MODE_REAL_BLOCKED: Evidence type not in safe mode allowlist and REAL not allowlisted",
        };
      }
    } else {
      // STUB mode requested
      if (isStubAllowed) {
        return {
          allowed: true,
          forcedMode: "STUB",
          reason: "Safe mode allows STUB for this evidence type",
        };
      } else {
        return {
          allowed: false,
          reason: "Evidence type not in safe mode allowlist",
        };
      }
    }
  } else {
    // Normal mode: REAL allowed if explicitly allowlisted
    if (requestedMode === "REAL") {
      const allowVar = REAL_MODE_ALLOWLIST[evidenceType];
      if (allowVar && process.env[allowVar] === "true") {
        return {
          allowed: true,
          forcedMode: undefined,
          reason: `REAL mode allowed via ${allowVar}`,
        };
      } else {
        return {
          allowed: false,
          reason: `REAL mode not allowlisted for ${evidenceType}. Set ${allowVar || "ALLOW_VAR"} to enable.`,
        };
      }
    } else {
      // STUB mode in normal mode
      if (isStubAllowed) {
        return {
          allowed: true,
          forcedMode: "STUB",
          reason: "STUB mode allowed",
        };
      } else {
        return {
          allowed: false,
          reason: "Evidence type not in allowlist",
        };
      }
    }
  }
}
