import { z } from "zod";

export const EvidenceNeedEnum = z.enum(["METRICS", "LOGS", "TRACES", "DEPLOYS", "CONFIG", "GOOGLE_STATUS"]);

export const EvidenceRequestToolSchema = z.object({
  kind: z.literal("CHRONOSOPS_EVIDENCE_REQUEST_V1"),
  requests: z
    .array(
      z.object({
        need: EvidenceNeedEnum,
        priority: z.enum(["P0", "P1", "P2"]),
        reason: z.string().min(1).max(400),

        scope: z
          .object({
            windowStart: z.string().optional(),
            windowEnd: z.string().optional(),
            service: z.string().optional(),
            region: z.string().optional(),
            // hard bounds
            maxItems: z.number().int().min(1).max(200).optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(10),
});

export type EvidenceRequestTool = z.infer<typeof EvidenceRequestToolSchema>;
