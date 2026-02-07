import { Module } from "@nestjs/common";
import { GeminiReasoningAdapter } from "./reasoning.adapter";

@Module({
  providers: [GeminiReasoningAdapter],
  exports: [GeminiReasoningAdapter],
})
export class ReasoningModule {}
