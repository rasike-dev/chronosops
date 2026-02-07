/**
 * Deterministic trace signature algorithm
 * Creates stable signatures from service, operation, and status
 */
export function traceSignature(input: { service?: string | null; operation: string; status: string }): string {
  const service = (input.service ?? "unknown").toLowerCase().trim();
  const op = input.operation.toLowerCase().trim().slice(0, 160);
  const st = input.status.toLowerCase().trim();
  return `${service}|${op}|${st}`.slice(0, 300);
}
