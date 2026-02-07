import { sha256Hex, hashObjectV1 } from "../evidence/hash";

export function hashPromptParts(system: string, user: string): string {
  return sha256Hex(system + "\n---\n" + user);
}

export function hashRequest(req: unknown): string {
  return hashObjectV1(req);
}

export function hashResponse(res: unknown): string {
  return hashObjectV1(res);
}
