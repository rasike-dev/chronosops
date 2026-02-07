import { Injectable, Logger } from "@nestjs/common";
import { ReasoningRequestSchema, ReasoningResponseSchema, type ReasoningRequest } from "@chronosops/contracts";
import { buildReasoningPrompt, PROMPT_VERSION } from "./reasoning.prompt";
import { ReasoningError } from "./reasoning.errors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Valid hypothesis IDs (from catalog)
const VALID_HYPOTHESIS_IDS = [
  "DB_QUERY_REGRESSION",
  "CONFIG_REGRESSION",
  "DEPLOY_BUG",
  "DOWNSTREAM_OUTAGE",
  "CAPACITY_SATURATION",
  "NETWORK_DNS_ISSUE",
  "CACHE_MISS_STORM",
  "RATE_LIMIT_THROTTLING",
  "AUTH_OIDC_ISSUE",
  "UNKNOWN",
] as const;

export type ReasoningResult = {
  response: ReturnType<typeof ReasoningResponseSchema.parse>;
  prompt: { system: string; user: string };
  request: ReasoningRequest;
};

@Injectable()
export class GeminiReasoningAdapter {
  private readonly logger = new Logger(GeminiReasoningAdapter.name);
  private readonly genAI: GoogleGenerativeAI | null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log(`Gemini API initialized with model: ${modelName}`);
    } else {
      this.genAI = null;
      this.logger.warn("GEMINI_API_KEY not set - Gemini reasoning will fail. Set GEMINI_API_KEY in .env file.");
    }
  }

  async reason(input: unknown): Promise<ReasoningResult> {
    const req = ReasoningRequestSchema.parse(input) as ReasoningRequest;

    const prompt = buildReasoningPrompt(req);

    let rawText = "";
    try {
      if (!this.genAI) {
        throw new ReasoningError(
          "GEMINI_API_KEY not configured",
          "MODEL_CALL_FAILED",
          { message: "Please set GEMINI_API_KEY in your .env file" }
        );
      }

      // Use Gemini model from environment variable (default: gemini-3-flash-preview)
      const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Combine system and user prompts
      const fullPrompt = `${prompt.system}\n\n${prompt.user}`;

      // Day 21: Add timeout for Gemini API call (30 seconds)
      const timeoutMs = 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      let result;
      try {
        result = await model.generateContent(fullPrompt);
        clearTimeout(timeoutId);
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError' || controller.signal.aborted) {
          throw new ReasoningError("Gemini API call timed out after 30s", "MODEL_CALL_FAILED");
        }
        throw error;
      }
      
      const response = await result.response;
      rawText = response.text();

      if (!rawText || !rawText.trim()) {
        throw new ReasoningError("Empty model output", "MODEL_OUTPUT_EMPTY");
      }

      // Extract JSON from response (handle markdown code blocks if present)
      rawText = rawText.trim();
      if (rawText.startsWith("```json")) {
        rawText = rawText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
    } catch (e: any) {
      if (e instanceof ReasoningError) {
        throw e;
      }
      throw new ReasoningError("Gemini call failed", "MODEL_CALL_FAILED", { cause: String(e?.message ?? e) });
    }

    if (!rawText || !rawText.trim()) {
      throw new ReasoningError("Empty model output", "MODEL_OUTPUT_EMPTY");
    }

    // Expect JSON-only output (enforce)
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      throw new ReasoningError("Model output was not valid JSON", "MODEL_OUTPUT_INVALID", { rawText: rawText.slice(0, 2000) });
    }

    // Force promptVersion if missing/mismatch (optional guard)
    parsed.promptVersion = parsed.promptVersion ?? PROMPT_VERSION;

    const validated = ReasoningResponseSchema.safeParse(parsed);
    if (!validated.success) {
      throw new ReasoningError("Model output failed schema validation", "MODEL_OUTPUT_INVALID", {
        issues: validated.error.flatten(),
      });
    }

    // Validate that all hypothesis IDs are in the candidate set
    const candidateSet = new Set(req.candidates);
    const validIdsSet = new Set(VALID_HYPOTHESIS_IDS);
    
    for (const hypothesis of validated.data.hypotheses) {
      // Check if ID is in catalog
      if (!validIdsSet.has(hypothesis.id as any)) {
        throw new ReasoningError(
          `Invalid hypothesis ID: ${hypothesis.id} (not in catalog)`,
          "MODEL_OUTPUT_INVALID",
          { hypothesisId: hypothesis.id, candidates: req.candidates, validIds: Array.from(validIdsSet) }
        );
      }
      // Check if ID is in candidate set
      if (!candidateSet.has(hypothesis.id)) {
        throw new ReasoningError(
          `Hypothesis ID ${hypothesis.id} not in candidate set`,
          "MODEL_OUTPUT_INVALID",
          { hypothesisId: hypothesis.id, candidates: req.candidates }
        );
      }
    }

    return {
      response: validated.data,
      prompt,
      request: req,
    };
  }
}
