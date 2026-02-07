import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AnalysisCompareSchema, type AnalysisCompare, type DiffItem, type ReasoningResponse, type EvidenceCompleteness } from "@chronosops/contracts";

@Injectable()
export class AnalysisCompareService {
  constructor(private readonly prisma: PrismaService) {}

  async compare(incidentId: string, analysisIdA: string, analysisIdB: string): Promise<AnalysisCompare> {
    // 1) Load both analyses and verify they belong to the same incident
    const [analysisA, analysisB] = await Promise.all([
      this.prisma.incidentAnalysis.findUnique({
        where: { id: analysisIdA },
        include: {
          evidenceBundle: {
            select: {
              bundleId: true,
              payload: true,
            },
          },
        },
      }),
      this.prisma.incidentAnalysis.findUnique({
        where: { id: analysisIdB },
        include: {
          evidenceBundle: {
            select: {
              bundleId: true,
              payload: true,
            },
          },
        },
      }),
    ]);

    if (!analysisA || !analysisB) {
      throw new Error(`One or both analyses not found: ${analysisIdA}, ${analysisIdB}`);
    }

    if (analysisA.incidentId !== incidentId || analysisB.incidentId !== incidentId) {
      throw new Error(`Analyses do not belong to incident ${incidentId}`);
    }

    // 2) Extract data
    const reasoningA = analysisA.reasoningJson as ReasoningResponse | null;
    const reasoningB = analysisB.reasoningJson as ReasoningResponse | null;
    const completenessA = analysisA.evidenceCompleteness as EvidenceCompleteness | null;
    const completenessB = analysisB.evidenceCompleteness as EvidenceCompleteness | null;
    const bundleA = analysisA.evidenceBundle;
    const bundleB = analysisB.evidenceBundle;

    // 3) Evidence diff
    const bundleChanged = bundleA?.bundleId !== bundleB?.bundleId;
    const artifactDiffs: DiffItem[] = [];

    const artifactsA = ((bundleA?.payload as any)?.artifacts || []) as Array<{
      artifactId: string;
      kind: string;
      title: string;
      summary?: string;
    }>;
    const artifactsB = ((bundleB?.payload as any)?.artifacts || []) as Array<{
      artifactId: string;
      kind: string;
      title: string;
      summary?: string;
    }>;

    const artifactMapA = new Map(artifactsA.map((a) => [a.artifactId, a]));
    const artifactMapB = new Map(artifactsB.map((a) => [a.artifactId, a]));

    // Find added/removed/changed artifacts
    const allArtifactIds = new Set([...artifactMapA.keys(), ...artifactMapB.keys()]);

    for (const artifactId of allArtifactIds) {
      const artifactA = artifactMapA.get(artifactId);
      const artifactB = artifactMapB.get(artifactId);

      if (!artifactA && artifactB) {
        artifactDiffs.push({
          type: "ADDED",
          key: `artifact:${artifactId}`,
          after: {
            kind: artifactB.kind,
            title: artifactB.title,
            summary: artifactB.summary?.substring(0, 200),
          },
        });
      } else if (artifactA && !artifactB) {
        artifactDiffs.push({
          type: "REMOVED",
          key: `artifact:${artifactId}`,
          before: {
            kind: artifactA.kind,
            title: artifactA.title,
            summary: artifactA.summary?.substring(0, 200),
          },
        });
      } else if (artifactA && artifactB) {
        // Check if summary changed (simplified: compare summary strings)
        const summaryA = artifactA.summary || "";
        const summaryB = artifactB.summary || "";
        if (summaryA !== summaryB || artifactA.kind !== artifactB.kind || artifactA.title !== artifactB.title) {
          artifactDiffs.push({
            type: "CHANGED",
            key: `artifact:${artifactId}`,
            before: {
              kind: artifactA.kind,
              title: artifactA.title,
              summary: summaryA.substring(0, 200),
            },
            after: {
              kind: artifactB.kind,
              title: artifactB.title,
              summary: summaryB.substring(0, 200),
            },
          });
        } else {
          artifactDiffs.push({
            type: "UNCHANGED",
            key: `artifact:${artifactId}`,
          });
        }
      }
    }

    // 4) Hypothesis drift
    const hypothesisDiffs: DiffItem[] = [];
    const hypothesesA = reasoningA?.hypotheses || [];
    const hypothesesB = reasoningB?.hypotheses || [];

    const hypMapA = new Map(hypothesesA.map((h: any, idx: number) => [h.id, { ...h, rank: idx + 1 }]));
    const hypMapB = new Map(hypothesesB.map((h: any, idx: number) => [h.id, { ...h, rank: idx + 1 }]));

    const allHypIds = new Set([...hypMapA.keys(), ...hypMapB.keys()]);

    for (const hypId of allHypIds) {
      const hypA = hypMapA.get(hypId);
      const hypB = hypMapB.get(hypId);

      if (!hypA && hypB) {
        hypothesisDiffs.push({
          type: "ADDED",
          key: `hypothesis:${hypId}`,
          after: {
            rank: hypB.rank,
            confidence: hypB.confidence,
            title: hypB.title,
          },
        });
      } else if (hypA && !hypB) {
        hypothesisDiffs.push({
          type: "REMOVED",
          key: `hypothesis:${hypId}`,
          before: {
            rank: hypA.rank,
            confidence: hypA.confidence,
            title: hypA.title,
          },
        });
      } else if (hypA && hypB) {
        const rankChanged = hypA.rank !== hypB.rank;
        const confidenceChanged = Math.abs(hypA.confidence - hypB.confidence) > 0.01; // Threshold for "changed"

        if (rankChanged || confidenceChanged) {
          hypothesisDiffs.push({
            type: "CHANGED",
            key: `hypothesis:${hypId}`,
            before: {
              rank: hypA.rank,
              confidence: hypA.confidence,
              title: hypA.title,
            },
            after: {
              rank: hypB.rank,
              confidence: hypB.confidence,
              title: hypB.title,
            },
            note: rankChanged
              ? `Rank changed ${hypA.rank} → ${hypB.rank}`
              : `Confidence changed ${hypA.confidence.toFixed(2)} → ${hypB.confidence.toFixed(2)}`,
          });
        } else {
          hypothesisDiffs.push({
            type: "UNCHANGED",
            key: `hypothesis:${hypId}`,
          });
        }
      }
    }

    // 5) Explainability drift
    const explainA = reasoningA?.explainability;
    const explainB = reasoningB?.explainability;

    const primarySignalA = explainA?.primarySignal || "UNKNOWN";
    const primarySignalB = explainB?.primarySignal || "UNKNOWN";
    const primarySignalChanged = primarySignalA !== primarySignalB;

    const latencyFactorA = explainA?.latencyFactor || 1.0;
    const latencyFactorB = explainB?.latencyFactor || 1.0;
    const errorFactorA = explainA?.errorFactor || 1.0;
    const errorFactorB = explainB?.errorFactor || 1.0;

    const latencyFactorChanged = Math.abs(latencyFactorA - latencyFactorB) > 0.01;
    const errorFactorChanged = Math.abs(errorFactorA - errorFactorB) > 0.01;
    const rationaleChanged = explainA?.rationale !== explainB?.rationale;

    const primarySignalDiff: DiffItem = {
      type: primarySignalChanged ? "CHANGED" : "UNCHANGED",
      key: "primarySignal",
      before: primarySignalChanged ? primarySignalA : undefined,
      after: primarySignalChanged ? primarySignalB : undefined,
      note: primarySignalChanged ? `Primary signal changed: ${primarySignalA} → ${primarySignalB}` : null,
    };

    // 6) Actions drift
    const actionsDiffs: DiffItem[] = [];
    const actionsA = reasoningA?.recommendedActions || [];
    const actionsB = reasoningB?.recommendedActions || [];

    const actionMapA = new Map(actionsA.map((a: any) => [a.id || a.title, a]));
    const actionMapB = new Map(actionsB.map((a: any) => [a.id || a.title, a]));

    const allActionKeys = new Set([...actionMapA.keys(), ...actionMapB.keys()]);

    for (const actionKey of allActionKeys) {
      const actionA = actionMapA.get(actionKey);
      const actionB = actionMapB.get(actionKey);

      if (!actionA && actionB) {
        actionsDiffs.push({
          type: "ADDED",
          key: `action:${actionKey}`,
          after: {
            priority: actionB.priority,
            title: actionB.title,
            stepsCount: actionB.steps.length,
          },
        });
      } else if (actionA && !actionB) {
        actionsDiffs.push({
          type: "REMOVED",
          key: `action:${actionKey}`,
          before: {
            priority: actionA.priority,
            title: actionA.title,
            stepsCount: actionA.steps.length,
          },
        });
      } else if (actionA && actionB) {
        const priorityChanged = actionA.priority !== actionB.priority;
        const stepsChanged = JSON.stringify(actionA.steps) !== JSON.stringify(actionB.steps);

        if (priorityChanged || stepsChanged) {
          actionsDiffs.push({
            type: "CHANGED",
            key: `action:${actionKey}`,
            before: {
              priority: actionA.priority,
              title: actionA.title,
              stepsCount: actionA.steps.length,
            },
            after: {
              priority: actionB.priority,
              title: actionB.title,
              stepsCount: actionB.steps.length,
            },
            note: priorityChanged
              ? `Priority changed ${actionA.priority} → ${actionB.priority}`
              : "Steps changed",
          });
        } else {
          actionsDiffs.push({
            type: "UNCHANGED",
            key: `action:${actionKey}`,
          });
        }
      }
    }

    // 7) Completeness drift
    const scoreA = completenessA?.score || 0;
    const scoreB = completenessB?.score || 0;
    const scoreChanged = scoreA !== scoreB;

    const scoreDiff: DiffItem = {
      type: scoreChanged ? "CHANGED" : "UNCHANGED",
      key: "completenessScore",
      before: scoreChanged ? scoreA : undefined,
      after: scoreChanged ? scoreB : undefined,
      note: scoreChanged ? `Completeness score changed: ${scoreA} → ${scoreB}` : null,
    };

    const missingDiffs: DiffItem[] = [];
    const missingA = completenessA?.missing || [];
    const missingB = completenessB?.missing || [];

    const missingMapA = new Map(missingA.map((m: any) => [m.need, m]));
    const missingMapB = new Map(missingB.map((m: any) => [m.need, m]));

    const allMissingNeeds = new Set([...missingMapA.keys(), ...missingMapB.keys()]);

    for (const need of allMissingNeeds) {
      const missingA_item = missingMapA.get(need);
      const missingB_item = missingMapB.get(need);

      if (!missingA_item && missingB_item) {
        missingDiffs.push({
          type: "ADDED",
          key: `missing:${need}`,
          after: {
            need: missingB_item.need,
            priority: missingB_item.priority,
            reason: missingB_item.reason?.substring(0, 200),
          },
        });
      } else if (missingA_item && !missingB_item) {
        missingDiffs.push({
          type: "REMOVED",
          key: `missing:${need}`,
          before: {
            need: missingA_item.need,
            priority: missingA_item.priority,
            reason: missingA_item.reason?.substring(0, 200),
          },
        });
      } else if (missingA_item && missingB_item) {
        // Check if priority or reason changed
        const priorityChanged = missingA_item.priority !== missingB_item.priority;
        const reasonChanged = missingA_item.reason !== missingB_item.reason;

        if (priorityChanged || reasonChanged) {
          missingDiffs.push({
            type: "CHANGED",
            key: `missing:${need}`,
            before: {
              need: missingA_item.need,
              priority: missingA_item.priority,
              reason: missingA_item.reason?.substring(0, 200),
            },
            after: {
              need: missingB_item.need,
              priority: missingB_item.priority,
              reason: missingB_item.reason?.substring(0, 200),
            },
            note: priorityChanged ? `Priority changed ${missingA_item.priority} → ${missingB_item.priority}` : "Reason updated",
          });
        } else {
          missingDiffs.push({
            type: "UNCHANGED",
            key: `missing:${need}`,
          });
        }
      }
    }

    // 8) Summary headline + keyChanges
    const keyChanges: string[] = [];

    if (bundleChanged) {
      keyChanges.push(`Evidence bundle changed: ${bundleA?.bundleId || "none"} → ${bundleB?.bundleId || "none"}`);
    }

    const addedArtifacts = artifactDiffs.filter((d) => d.type === "ADDED").length;
    const removedArtifacts = artifactDiffs.filter((d) => d.type === "REMOVED").length;
    if (addedArtifacts > 0) {
      keyChanges.push(`Added ${addedArtifacts} evidence artifact(s)`);
    }
    if (removedArtifacts > 0) {
      keyChanges.push(`Removed ${removedArtifacts} evidence artifact(s)`);
    }

    const topHypA = hypothesesA[0];
    const topHypB = hypothesesB[0];
    if (topHypA && topHypB && topHypA.id !== topHypB.id) {
      keyChanges.push(`Top hypothesis changed: ${topHypA.title} → ${topHypB.title}`);
    }

    const confidenceA = reasoningA?.overallConfidence || 0;
    const confidenceB = reasoningB?.overallConfidence || 0;
    if (Math.abs(confidenceA - confidenceB) > 0.01) {
      keyChanges.push(`Confidence changed: ${confidenceA.toFixed(2)} → ${confidenceB.toFixed(2)}`);
    }

    if (scoreChanged) {
      keyChanges.push(`Completeness score changed: ${scoreA} → ${scoreB}`);
    }

    if (primarySignalChanged) {
      keyChanges.push(`Primary signal changed: ${primarySignalA} → ${primarySignalB}`);
    }

    const addedActions = actionsDiffs.filter((d) => d.type === "ADDED").length;
    const removedActions = actionsDiffs.filter((d) => d.type === "REMOVED").length;
    if (addedActions > 0) {
      keyChanges.push(`Added ${addedActions} recommended action(s)`);
    }
    if (removedActions > 0) {
      keyChanges.push(`Removed ${removedActions} recommended action(s)`);
    }

    const headline = keyChanges.length > 0
      ? `Analysis comparison: ${keyChanges.length} key change(s) detected`
      : "Analysis comparison: no significant changes detected";

    const compare: AnalysisCompare = {
      kind: "CHRONOSOPS_ANALYSIS_COMPARE_V1",
      incidentId,
      a: {
        analysisId: analysisIdA,
        createdAt: analysisA.createdAt.toISOString(),
        evidenceBundleId: bundleA?.bundleId || null,
        confidence: confidenceA,
      },
      b: {
        analysisId: analysisIdB,
        createdAt: analysisB.createdAt.toISOString(),
        evidenceBundleId: bundleB?.bundleId || null,
        confidence: confidenceB,
      },
      evidence: {
        bundleChanged,
        artifactDiffs: artifactDiffs.slice(0, 200),
      },
      reasoning: {
        primarySignalDiff,
        hypothesisDiffs: hypothesisDiffs.slice(0, 200),
        actionsDiffs: actionsDiffs.slice(0, 200),
      },
      completeness: {
        scoreDiff,
        missingDiffs: missingDiffs.slice(0, 200),
      },
      summary: {
        headline,
        keyChanges: keyChanges.slice(0, 20),
      },
    };

    return AnalysisCompareSchema.parse(compare);
  }
}
