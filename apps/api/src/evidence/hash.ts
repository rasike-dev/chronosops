import crypto from "node:crypto";

// Canonicalize JSON with stable key ordering (recursive).
export function canonicalize(value: any): any {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const out: any = {};
    for (const k of keys) out[k] = canonicalize(value[k]);
    return out;
  }
  return value;
}

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export function hashObjectV1(obj: unknown): string {
  const canonical = canonicalize(obj);
  const json = JSON.stringify(canonical);
  return sha256Hex(json);
}
