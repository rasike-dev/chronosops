import { z } from "zod";

export const StartInvestigationRequestSchema = z.object({
  maxIterations: z.number().int().min(1).max(10).default(5),
  confidenceTarget: z.number().min(0.5).max(0.99).default(0.8),
});

export const StartInvestigationResponseSchema = z.object({
  sessionId: z.string().min(1),
  status: z.string(),
});

export const InvestigationStatusSchema = z.object({
  sessionId: z.string(),
  incidentId: z.string(),
  status: z.string(),
  currentIteration: z.number().int(),
  maxIterations: z.number().int(),
  confidenceTarget: z.number(),
  reason: z.string().optional().nullable(),
  iterations: z.array(
    z.object({
      iteration: z.number().int(),
      createdAt: z.string(),
      evidenceBundleId: z.string().optional().nullable(),
      analysisId: z.string().optional().nullable(),
      completenessScore: z.number().int().optional().nullable(),
      overallConfidence: z.number().optional().nullable(),
    })
  ),
});

export type StartInvestigationRequest = z.infer<typeof StartInvestigationRequestSchema>;
export type StartInvestigationResponse = z.infer<typeof StartInvestigationResponseSchema>;
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;
