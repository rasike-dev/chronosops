export class ReasoningError extends Error {
  constructor(
    message: string,
    public code:
      | "MODEL_CALL_FAILED"
      | "MODEL_OUTPUT_INVALID"
      | "MODEL_OUTPUT_EMPTY"
      | "PROMPT_BUILD_FAILED",
    public details?: any
  ) {
    super(message);
    this.name = "ReasoningError";
  }
}
