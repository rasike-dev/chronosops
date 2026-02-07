import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { hashObjectV1 } from "../../../evidence/hash";

export interface VerificationResult {
  ok: boolean;
  verifiedCount: number;
  firstFailureIndex: number | null;
  firstFailureReason: string | null;
  chainId: string;
  totalEvents: number;
}

@Injectable()
export class AuditVerifyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifies the audit chain integrity for events related to an incident.
   * 
   * Checks:
   * 1. Sequential continuity: each event.prevHash matches previous event.hash
   * 2. Hash integrity: recompute hash for each event and compare stored hash
   * 
   * Returns verification result with first failure if any.
   */
  async verifyIncidentChain(incidentId: string): Promise<VerificationResult> {
    const chainId = process.env.CHRONOSOPS_AUDIT_CHAIN_ID ?? "chronosops";

    // Get all audit events that reference this incident
    // Strategy: get events where payload contains incidentId OR entity types linked to incident
    // @ts-ignore - auditEvent will be available after migration
    const allEvents = await this.prisma.auditEvent.findMany({
      where: { chainId },
      orderBy: { seq: "asc" },
    });

    // Filter events related to this incident
    // First pass: simple payload checks
    const candidateEvents = allEvents.filter((event: any) => {
      const payload = event.payload as any;
      return payload?.incidentId === incidentId || payload?.analysisId || payload?.bundleId || payload?.sessionId;
    });

    // Second pass: verify entity relationships (async)
    const incidentEvents: any[] = [];
    for (const event of candidateEvents) {
      const payload = event.payload as any;
      if (payload?.incidentId === incidentId) {
        incidentEvents.push(event);
      } else if (payload?.analysisId) {
        const isForIncident = await this.isAnalysisForIncident(payload.analysisId, incidentId);
        if (isForIncident) incidentEvents.push(event);
      } else if (payload?.bundleId) {
        const isForIncident = await this.isBundleForIncident(payload.bundleId, incidentId);
        if (isForIncident) incidentEvents.push(event);
      } else if (payload?.sessionId) {
        const isForIncident = await this.isSessionForIncident(payload.sessionId, incidentId);
        if (isForIncident) incidentEvents.push(event);
      }
    }

    // If no events found, verify the whole chain (fallback)
    const eventsToVerify = incidentEvents.length > 0 ? incidentEvents : allEvents.slice(-500); // Last 500 events

    return this.verifyChain(eventsToVerify, chainId);
  }

  /**
   * Verifies a sequence of audit events for chain integrity.
   */
  private async verifyChain(events: any[], chainId: string): Promise<VerificationResult> {
    if (events.length === 0) {
      return {
        ok: true,
        verifiedCount: 0,
        firstFailureIndex: null,
        firstFailureReason: null,
        chainId,
        totalEvents: 0,
      };
    }

    // Verify sequential continuity and hash integrity
    for (let i = 0; i < events.length; i++) {
      const event = events[i];

      // Check prevHash continuity (except first event)
      if (i > 0) {
        const prevEvent = events[i - 1];
        if (event.prevHash !== prevEvent.hash) {
          return {
            ok: false,
            verifiedCount: i,
            firstFailureIndex: event.seq,
            firstFailureReason: `Chain broken at seq ${event.seq}: prevHash mismatch. Expected ${prevEvent.hash.substring(0, 16)}..., got ${event.prevHash.substring(0, 16)}...`,
            chainId,
            totalEvents: events.length,
          };
        }
      } else {
        // First event should have prevHash = "GENESIS" or match previous chain event
        if (event.seq > 1 && event.prevHash === "GENESIS") {
          // This is suspicious - seq > 1 but prevHash is GENESIS
          // Check if there's a gap by looking at previous event in our list
          if (i > 0) {
            // We already verified prevEvent, so this shouldn't happen
            // But if it does, it's a chain break
            return {
              ok: false,
              verifiedCount: 0,
              firstFailureIndex: event.seq,
              firstFailureReason: `Chain gap at seq ${event.seq}: prevHash is GENESIS but seq > 1`,
              chainId,
              totalEvents: events.length,
            };
          }
        }
      }

      // Recompute hash and verify
      const hashInput = {
        chainId: event.chainId,
        seq: event.seq,
        prevHash: event.prevHash,
        eventType: event.eventType,
        entityType: event.entityType,
        entityId: event.entityId,
        entityRef: event.entityRef ?? null,
        payload: event.payload,
      };

      const computedHash = hashObjectV1(hashInput);
      if (computedHash !== event.hash) {
        return {
          ok: false,
          verifiedCount: i,
          firstFailureIndex: event.seq,
          firstFailureReason: `Hash mismatch at seq ${event.seq}: computed ${computedHash.substring(0, 16)}..., stored ${event.hash.substring(0, 16)}... (tampering detected)`,
          chainId,
          totalEvents: events.length,
        };
      }
    }

    return {
      ok: true,
      verifiedCount: events.length,
      firstFailureIndex: null,
      firstFailureReason: null,
      chainId,
      totalEvents: events.length,
    };
  }

  private async isAnalysisForIncident(analysisId: string, incidentId: string): Promise<boolean> {
    const analysis = await this.prisma.incidentAnalysis.findUnique({
      where: { id: analysisId },
      select: { incidentId: true },
    });
    return analysis?.incidentId === incidentId;
  }

  private async isBundleForIncident(bundleId: string, incidentId: string): Promise<boolean> {
    const bundle = await this.prisma.evidenceBundle.findUnique({
      where: { bundleId },
      select: { incidentId: true },
    });
    return bundle?.incidentId === incidentId;
  }

  private async isSessionForIncident(sessionId: string, incidentId: string): Promise<boolean> {
    const session = await this.prisma.investigationSession.findUnique({
      where: { id: sessionId },
      select: { incidentId: true },
    });
    return session?.incidentId === incidentId;
  }
}
