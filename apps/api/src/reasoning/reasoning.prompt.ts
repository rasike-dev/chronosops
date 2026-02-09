import { ReasoningRequest } from "@chronosops/contracts";

export const PROMPT_VERSION = "v1";

export function buildReasoningPrompt(req: ReasoningRequest) {
  const system = [
    "You are ChronosOps, an autonomous SRE investigator.",
    "Use ONLY the provided evidence summaries. Do not invent evidence.",
    "Return STRICT JSON that conforms EXACTLY to the required schema.",
    "Cite evidence by artifactId in evidenceRefs.",
    `CRITICAL: You MUST pick hypothesis IDs only from the candidates list: ${req.candidates.join(", ")}.`,
    "If you want to suggest a different hypothesis, map it to the closest candidate or choose UNKNOWN.",
    "",
    "REQUIRED JSON STRUCTURE (return this exact format):",
    JSON.stringify({
      kind: "CHRONOSOPS_REASONING_V1",
      model: "gemini-3-flash-preview",
      promptVersion: "v1",
      hypotheses: [
        {
          id: "DEPLOY_BUG",
          title: "Deployment introduced bug",
          confidence: 0.9,
          rationale: "Reasoning here...",
          evidenceRefs: ["artifact-id-1", "artifact-id-2"]
        }
      ],
      explainability: {
        primarySignal: "ERRORS",
        latencyFactor: 0.3,
        errorFactor: 0.9,
        rationale: "Explanation here...",
        evidenceRefs: ["artifact-id-1"]
      },
      recommendedActions: [
        {
          id: "ROLLBACK",
          title: "Rollback deployment",
          steps: ["Step 1", "Step 2"],
          priority: "P0",
          evidenceRefs: ["artifact-id-1"]
        }
      ],
      missingEvidenceRequests: [],
      overallConfidence: 0.85
    }, null, 2),
    "",
    "IMPORTANT:",
    "- Include ALL required fields: kind, model, promptVersion, hypotheses, explainability, overallConfidence",
    "- Use 'confidence' (not 'score') for hypotheses",
    "- Use 'rationale' (not 'reasoning') for hypotheses and explainability",
    "- overallConfidence must be between 0 and 1",
    "- Return ONLY the JSON object, no markdown code blocks, no extra text",
  ].join("\n");

  const user = [
    "Analyze the following incident and evidence:",
    "",
    `Incident Summary: ${req.context.incidentSummary}`,
    `Source Type: ${req.context.sourceType}`,
    `Timeline: ${req.context.timeline.start} to ${req.context.timeline.end}`,
    "",
    "Evidence Artifacts:",
    ...req.context.evidenceArtifacts.map(a => 
      `- ${a.artifactId} (${a.kind}): ${a.title}\n  ${a.summary}`
    ),
    "",
    `Candidate Hypothesis IDs (you MUST use only these): ${req.candidates.join(", ")}`,
    "",
    "Return your analysis in the EXACT JSON format shown above.",
  ].join("\n");

  return { system, user };
}
