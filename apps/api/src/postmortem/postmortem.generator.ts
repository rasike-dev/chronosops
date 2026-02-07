import { PostmortemV2Schema, type PostmortemV2, type ReasoningResponse, type EvidenceCompleteness } from "@chronosops/contracts";

export const POSTMORTEM_GENERATOR_VERSION = "v2";

export interface PostmortemGeneratorInput {
  incident: {
    id: string;
    title: string | null;
    sourceType: "SCENARIO" | "GOOGLE_CLOUD";
    sourceRef: string | null;
    createdAt: Date;
  };
  analysis: {
    id: string;
    createdAt: Date;
    evidenceBundleId: string | null;
    evidenceCompleteness: EvidenceCompleteness | null;
    reasoningJson: ReasoningResponse | null;
  };
  evidenceBundle: {
    bundleId: string;
    artifacts: Array<{
      artifactId: string;
      kind: string;
      title: string;
      summary: string;
    }>;
    googleEvidenceLite?: {
      url?: string | null;
      timeline?: {
        begin?: string | null;
        end?: string | null;
        update?: string | null;
      };
    } | null;
  };
  promptTrace?: {
    id: string;
    promptHash: string;
    responseHash: string;
  } | null;
  timeline: {
    start: string;
    end: string;
  };
}

export function generatePostmortemV2(input: PostmortemGeneratorInput): PostmortemV2 {
  const { incident, analysis, evidenceBundle, promptTrace, timeline } = input;

  // Summary
  const headline = incident.title || `Incident ${incident.id}`;
  
  // Build impact from reasoning or analysis
  let impact = "Incident detected and analyzed.";
  let rootCause = "Analysis in progress.";
  let confidence = 0.5;
  
  if (analysis.reasoningJson) {
    const reasoning = analysis.reasoningJson;
    confidence = reasoning.overallConfidence;
    
    // Build impact from explainability
    const primarySignal = reasoning.explainability.primarySignal;
    const latencyFactor = reasoning.explainability.latencyFactor || 1.0;
    const errorFactor = reasoning.explainability.errorFactor || 1.0;
    
    if (primarySignal === "LATENCY") {
      impact = `Latency spike detected (${latencyFactor.toFixed(2)}x baseline). ${reasoning.explainability.rationale.slice(0, 500)}`;
    } else if (primarySignal === "ERRORS") {
      impact = `Error rate spike detected (${errorFactor.toFixed(2)}x baseline). ${reasoning.explainability.rationale.slice(0, 500)}`;
    } else {
      impact = reasoning.explainability.rationale.slice(0, 1000);
    }
    
    // Root cause from top hypothesis
    if (reasoning.hypotheses && reasoning.hypotheses.length > 0) {
      const topHyp = reasoning.hypotheses[0];
      rootCause = `${topHyp.title}. ${topHyp.rationale.slice(0, 1000)}`;
    }
  }

  // Timeline notes
  const timelineNotes: string[] = [];
  if (evidenceBundle.googleEvidenceLite?.timeline) {
    const gl = evidenceBundle.googleEvidenceLite;
    const glTimeline = gl.timeline;
    if (glTimeline?.begin) {
      timelineNotes.push(`Incident started: ${new Date(glTimeline.begin).toISOString()}`);
    }
    if (glTimeline?.update) {
      timelineNotes.push(`Last update: ${new Date(glTimeline.update).toISOString()}`);
    }
    if (glTimeline?.end) {
      timelineNotes.push(`Incident resolved: ${new Date(glTimeline.end).toISOString()}`);
    }
  } else {
    timelineNotes.push(`Analysis window: ${timeline.start} to ${timeline.end}`);
  }

  // Missing evidence
  const missing: string[] = [];
  if (analysis.evidenceCompleteness?.missing) {
    for (const need of analysis.evidenceCompleteness.missing) {
      const priority = need.priority || "P1";
      const reason = need.reason || "Additional evidence needed";
      missing.push(`${priority} ${need.need}: ${reason}`);
    }
  }

  // Artifact summaries
  const artifactSummaries = evidenceBundle.artifacts.map((a) => ({
    artifactId: a.artifactId,
    kind: a.kind,
    title: a.title,
    summary: a.summary,
  }));

  // Reasoning
  const primarySignal = analysis.reasoningJson?.explainability?.primarySignal || "UNKNOWN";
  const reasoningRationale = analysis.reasoningJson?.explainability?.rationale || "Analysis in progress.";
  
  const topHypotheses = (analysis.reasoningJson?.hypotheses || []).slice(0, 10).map((h: any) => ({
    id: h.id,
    title: h.title,
    confidence: h.confidence,
    rationale: h.rationale,
    evidenceRefs: h.evidenceRefs || [],
  }));

  // Actions
  const actions = (analysis.reasoningJson?.recommendedActions || []).slice(0, 20).map((a: any) => ({
    priority: a.priority,
    title: a.title,
    steps: a.steps,
    evidenceRefs: a.evidenceRefs || [],
  }));

  // References
  const references: Array<{ kind: "EVIDENCE_BUNDLE" | "PROMPT_TRACE" | "ANALYSIS"; ref: string; hash?: string | null }> = [
    {
      kind: "EVIDENCE_BUNDLE",
      ref: evidenceBundle.bundleId,
      hash: evidenceBundle.bundleId, // bundleId is content-addressed
    },
    {
      kind: "ANALYSIS",
      ref: analysis.id,
    },
  ];

  if (promptTrace) {
    references.push({
      kind: "PROMPT_TRACE",
      ref: promptTrace.id,
      hash: promptTrace.responseHash,
    });
  }

  // Sections (empty for now, can be populated by renderer)
  const sections: Array<{ title: string; content: string }> = [];

  const postmortem: PostmortemV2 = {
    kind: "CHRONOSOPS_POSTMORTEM_V2",
    incidentId: incident.id,
    analysisId: analysis.id,
    generatedAt: new Date().toISOString(),
    generatorVersion: POSTMORTEM_GENERATOR_VERSION,
    source: {
      sourceType: incident.sourceType,
      sourceRef: incident.sourceRef,
      sourceUrl: evidenceBundle.googleEvidenceLite?.url || null,
    },
    summary: {
      headline,
      impact,
      rootCause,
      confidence,
    },
    timeline: {
      start: timeline.start,
      end: timeline.end,
      notes: timelineNotes,
    },
    evidence: {
      bundleId: evidenceBundle.bundleId,
      completenessScore: analysis.evidenceCompleteness?.score || 0,
      missing,
      artifactSummaries,
    },
    reasoning: {
      primarySignal: primarySignal as "LATENCY" | "ERRORS" | "UNKNOWN",
      rationale: reasoningRationale,
      topHypotheses,
    },
    actions,
    references,
    sections,
  };

  return PostmortemV2Schema.parse(postmortem);
}
