/**
 * Safe Mode Configuration
 * 
 * When enabled (default: true), enforces stricter safety controls:
 * - Collectors only run in STUB mode unless explicitly allowlisted
 * - Raw payload fields never returned to non-admin
 * - Prompt trace content hidden unless admin
 * - maxItems and window caps stricter
 */
export function isSafeMode(): boolean {
  const v = (process.env.CHRONOSOPS_SAFE_MODE ?? "true").toLowerCase();
  return v !== "false";
}
