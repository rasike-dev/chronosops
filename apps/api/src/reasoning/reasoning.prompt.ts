import { ReasoningRequest } from "@chronosops/contracts";

export const PROMPT_VERSION = "v1";

export function buildReasoningPrompt(req: ReasoningRequest) {
  // Keep this stable and small today. We'll evolve it Day 12+.
  const system = [
    "You are ChronosOps, an autonomous SRE investigator.",
    "Use ONLY the provided evidence summaries. Do not invent evidence.",
    "Return STRICT JSON that conforms to the provided schema.",
    "Cite evidence by artifactId in evidenceRefs.",
    `CRITICAL: You MUST pick hypothesis IDs only from the candidates list: ${req.candidates.join(", ")}.`,
    "If you want to suggest a different hypothesis, map it to the closest candidate or choose UNKNOWN.",
  ].join("\n");

  const user = {
    task: "Rank root-cause hypotheses, provide explainable reasoning, actions, and missing evidence requests.",
    request: req,
  };

  return { system, user: JSON.stringify(user) };
}
