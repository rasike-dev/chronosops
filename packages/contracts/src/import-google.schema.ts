import { z } from "zod";

export const ImportGoogleIncidentsRequestSchema = z.object({
  // optional: limit how many fetched/incidents saved (safe default)
  limit: z.number().int().min(1).max(200).optional(),
});

export type ImportGoogleIncidentsRequest = z.infer<
  typeof ImportGoogleIncidentsRequestSchema
>;

export const ImportGoogleIncidentsResponseSchema = z.object({
  imported: z.number().int().min(0),
  skipped: z.number().int().min(0),
  fetched: z.number().int().min(0),
  fetchedAt: z.string(),
});

export type ImportGoogleIncidentsResponse = z.infer<
  typeof ImportGoogleIncidentsResponseSchema
>;
