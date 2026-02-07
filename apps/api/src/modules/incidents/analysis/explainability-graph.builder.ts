// Import will work after contracts are built
let ExplainabilityGraphSchema: any;
let ExplainabilityGraph: any;
try {
  const contracts = require("@chronosops/contracts");
  ExplainabilityGraphSchema = contracts.ExplainabilityGraphSchema;
  ExplainabilityGraph = contracts.ExplainabilityGraph;
} catch {
  // Fallback: define inline types if contracts not built yet
  ExplainabilityGraphSchema = null;
}

export interface BuildGraphInput {
  incidentId: string;
  analysisId: string;
  analysis: {
    reasoningJson: any;
    evidenceCompleteness: any;
    evidenceBundleId: string | null;
  };
  evidenceBundle: {
    bundleId: string;
    payload: any;
  };
  postmortem?: {
    json: any;
  } | null;
}

export interface ExplainabilityGraph {
  kind: "CHRONOSOPS_EXPLAINABILITY_GRAPH_V1";
  incidentId: string;
  analysisId: string;
  nodes: Array<{
    id: string;
    type: "EVIDENCE" | "CLAIM" | "HYPOTHESIS" | "ACTION" | "CONCLUSION";
    title: string;
    subtitle?: string | null;
    meta?: Record<string, unknown>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string | null;
    weight?: number | null;
  }>;
}

/**
 * Builds an explainability graph deterministically from stored analysis data.
 * 
 * Graph structure:
 * - Evidence nodes (from bundle artifacts)
 * - Claim node (from explainability)
 * - Hypothesis nodes (from reasoning)
 * - Action nodes (from reasoning)
 * - Conclusion node (top hypothesis)
 * - Missing evidence nodes (from completeness)
 * 
 * Edges connect via evidenceRefs and logical relationships.
 */
export function buildExplainabilityGraph(input: BuildGraphInput): ExplainabilityGraph {
  const { incidentId, analysisId, analysis, evidenceBundle, postmortem } = input;

  const nodes: ExplainabilityGraph["nodes"] = [];
  const edges: ExplainabilityGraph["edges"] = [];

  // 1. Evidence nodes (from bundle artifacts)
  const artifacts = evidenceBundle.payload?.artifacts || [];
  const evidenceNodeMap = new Map<string, string>(); // artifactId -> nodeId

  for (const artifact of artifacts) {
    const artifactId = artifact.artifactId || artifact.kind || `artifact-${nodes.length}`;
    const nodeId = `evi:${artifactId}`;
    
    nodes.push({
      id: nodeId,
      type: "EVIDENCE",
      title: artifact.title || artifact.kind || "Evidence",
      subtitle: artifact.kind || null,
      meta: {
        artifactId,
        kind: artifact.kind,
        summary: artifact.summary || null,
      },
    });

    evidenceNodeMap.set(artifactId, nodeId);
  }

  // 2. Claim node (from explainability)
  const explainability = analysis.reasoningJson?.explainability;
  if (explainability) {
    const claimNodeId = "claim:primary";
    const primarySignal = explainability.primarySignal || "UNKNOWN";
    const rationale = explainability.rationale || "";
    const rationaleSnippet = rationale.length > 100 ? rationale.substring(0, 100) + "..." : rationale;

    nodes.push({
      id: claimNodeId,
      type: "CLAIM",
      title: `Primary Signal: ${primarySignal}`,
      subtitle: rationaleSnippet,
      meta: {
        primarySignal,
        latencyFactor: explainability.latencyFactor || 0,
        errorFactor: explainability.errorFactor || 0,
        rationale,
        evidenceRefs: explainability.evidenceRefs || [],
      },
    });

    // Connect evidence to claim (via evidenceRefs)
    if (explainability.evidenceRefs && Array.isArray(explainability.evidenceRefs)) {
      for (const ref of explainability.evidenceRefs) {
        const evidenceNodeId = evidenceNodeMap.get(ref);
        if (evidenceNodeId) {
          edges.push({
            from: evidenceNodeId,
            to: claimNodeId,
            label: "supports",
            weight: 0.8,
          });
        }
      }
    }
  }

  // 3. Hypothesis nodes (from reasoning)
  const hypotheses = analysis.reasoningJson?.hypotheses || [];
  const hypothesisNodeMap = new Map<string, string>(); // hypothesisId -> nodeId
  let topHypothesisId: string | null = null;
  let topHypothesisRank = Infinity;

  for (const hypothesis of hypotheses) {
    const hypothesisId = hypothesis.id || `hyp-${hypothesis.rank}`;
    const nodeId = `hyp:${hypothesisId}`;
    
    nodes.push({
      id: nodeId,
      type: "HYPOTHESIS",
      title: hypothesis.title || hypothesisId,
      subtitle: `Confidence: ${(hypothesis.confidence * 100).toFixed(0)}% | Rank: ${hypothesis.rank}`,
      meta: {
        hypothesisId,
        rank: hypothesis.rank,
        confidence: hypothesis.confidence,
        rationale: hypothesis.rationale || null,
        evidenceRefs: hypothesis.evidenceRefs || [],
      },
    });

    hypothesisNodeMap.set(hypothesisId, nodeId);

    // Track top hypothesis
    if (hypothesis.rank < topHypothesisRank) {
      topHypothesisRank = hypothesis.rank;
      topHypothesisId = hypothesisId;
    }

    // Connect evidence to hypothesis (via evidenceRefs)
    if (hypothesis.evidenceRefs && Array.isArray(hypothesis.evidenceRefs)) {
      for (const ref of hypothesis.evidenceRefs) {
        const evidenceNodeId = evidenceNodeMap.get(ref);
        if (evidenceNodeId) {
          edges.push({
            from: evidenceNodeId,
            to: nodeId,
            label: "supports",
            weight: hypothesis.confidence || 0.5,
          });
        }
      }
    }

    // Connect claim to hypothesis
    if (explainability) {
      const claimNodeId = "claim:primary";
      edges.push({
        from: claimNodeId,
        to: nodeId,
        label: "supports ranking",
        weight: hypothesis.confidence || 0.5,
      });
    }
  }

  // 4. Action nodes (from reasoning)
  const actions = analysis.reasoningJson?.recommendedActions || [];
  const actionNodeMap = new Map<string, string>(); // actionId -> nodeId

  for (const action of actions) {
    const actionId = action.id || `act-${actionNodeMap.size}`;
    const nodeId = `act:${actionId}`;
    
    // Map priority to weight
    const priorityWeight: Record<string, number> = {
      P0: 1.0,
      P1: 0.7,
      P2: 0.4,
    };
    const weight = priorityWeight[action.priority] || 0.5;

    nodes.push({
      id: nodeId,
      type: "ACTION",
      title: action.title || actionId,
      subtitle: `Priority: ${action.priority}`,
      meta: {
        actionId,
        priority: action.priority,
        steps: action.steps || [],
        evidenceRefs: action.evidenceRefs || [],
      },
    });

    actionNodeMap.set(actionId, nodeId);

    // Connect evidence to action (via evidenceRefs)
    if (action.evidenceRefs && Array.isArray(action.evidenceRefs)) {
      for (const ref of action.evidenceRefs) {
        const evidenceNodeId = evidenceNodeMap.get(ref);
        if (evidenceNodeId) {
          edges.push({
            from: evidenceNodeId,
            to: nodeId,
            label: "triggers",
            weight,
          });
        }
      }
    }
  }

  // 5. Conclusion node (from top hypothesis)
  const overallConfidence = analysis.reasoningJson?.overallConfidence || 0;
  const conclusionNodeId = "conclusion:root";
  const topHypothesisTitle = topHypothesisId && hypothesisNodeMap.has(topHypothesisId)
    ? hypotheses.find((h: any) => (h.id || `hyp-${h.rank}`) === topHypothesisId)?.title || "Unknown"
    : "Unknown";

  nodes.push({
    id: conclusionNodeId,
    type: "CONCLUSION",
    title: `Most likely root cause: ${topHypothesisTitle}`,
    subtitle: `Overall Confidence: ${(overallConfidence * 100).toFixed(0)}%`,
    meta: {
      topHypothesisId,
      overallConfidence,
    },
  });

  // Connect top hypothesis to conclusion
  if (topHypothesisId) {
    const topHypNodeId = hypothesisNodeMap.get(topHypothesisId);
    if (topHypNodeId) {
      edges.push({
        from: topHypNodeId,
        to: conclusionNodeId,
        label: "leads to",
        weight: overallConfidence,
      });
    }
  }

  // 6. Missing evidence nodes (from completeness)
  const missingNeeds = analysis.evidenceCompleteness?.missing || [];
  for (const need of missingNeeds) {
    const nodeId = `missing:${need.need}`;
    
    nodes.push({
      id: nodeId,
      type: "EVIDENCE",
      title: `Missing: ${need.need}`,
      subtitle: `Priority: ${need.priority}`,
      meta: {
        need: need.need,
        priority: need.priority,
        reason: need.reason || null,
      },
    });

    // Connect conclusion to missing evidence (shows what's needed)
    edges.push({
      from: conclusionNodeId,
      to: nodeId,
      label: "needs",
      weight: need.priority === "P0" ? 0.9 : need.priority === "P1" ? 0.6 : 0.3,
    });
  }

  // Build graph object
  const graph: ExplainabilityGraph = {
    kind: "CHRONOSOPS_EXPLAINABILITY_GRAPH_V1",
    incidentId,
    analysisId,
    nodes,
    edges,
  };

  // Validate if schema is available
  if (ExplainabilityGraphSchema) {
    return ExplainabilityGraphSchema.parse(graph);
  }

  return graph;
}
