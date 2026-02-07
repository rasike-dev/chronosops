import { z } from "zod";

export const GraphNodeSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["EVIDENCE", "CLAIM", "HYPOTHESIS", "ACTION", "CONCLUSION"]),
  title: z.string().min(1).max(200),
  subtitle: z.string().optional().nullable(),
  meta: z.record(z.unknown()).optional().default({}),
});

export const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional().nullable(),
  weight: z.number().min(0).max(1).optional().nullable(),
});

export const ExplainabilityGraphSchema = z.object({
  kind: z.literal("CHRONOSOPS_EXPLAINABILITY_GRAPH_V1"),
  incidentId: z.string(),
  analysisId: z.string(),
  nodes: z.array(GraphNodeSchema).max(400),
  edges: z.array(GraphEdgeSchema).max(800),
});

export type ExplainabilityGraph = z.infer<typeof ExplainabilityGraphSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
