import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashObjectV1 } from "../evidence/hash";

const logger = new Logger("AuditService");

export interface AuditEventInput {
  eventType: string;
  entityType: "EVIDENCE_BUNDLE" | "PROMPT_TRACE" | "INCIDENT_ANALYSIS" | "INVESTIGATION_SESSION" | "POSTMORTEM";
  entityId: string;
  entityRef?: string | null;
  payload: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Appends an event to the audit chain atomically.
   * 
   * Algorithm:
   * 1. Read latest event for chainId (seq, hash)
   * 2. seq = last.seq + 1 (or 1 if none)
   * 3. prevHash = last.hash (or "GENESIS")
   * 4. eventHashInput = canonicalJSON({chainId, seq, prevHash, eventType, entityType, entityId, entityRef, payload})
   * 5. hash = sha256(eventHashInput)
   * 6. Insert row in transaction
   * 
   * Uses unique constraint (chainId, seq) to prevent races.
   */
  async appendEvent(input: AuditEventInput): Promise<void> {
    const chainId = process.env.CHRONOSOPS_AUDIT_CHAIN_ID ?? "chronosops";

    try {
      await this.prisma.$transaction(async (tx) => {
        // Get latest event for this chain
        // @ts-ignore - auditEvent will be available after migration
        const last = await tx.auditEvent.findFirst({
          where: { chainId },
          orderBy: { seq: "desc" },
          select: { seq: true, hash: true },
        });

        const seq = (last?.seq ?? 0) + 1;
        const prevHash = last?.hash ?? "GENESIS";

        // Build hash input (canonical JSON)
        const hashInput = {
          chainId,
          seq,
          prevHash,
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          entityRef: input.entityRef ?? null,
          payload: input.payload,
        };

        // Compute hash
        const hash = hashObjectV1(hashInput);

        // Insert event (unique constraint prevents races)
        // @ts-ignore - auditEvent will be available after migration
        await tx.auditEvent.create({
          data: {
            chainId,
            seq,
            prevHash,
            hash,
            eventType: input.eventType,
            entityType: input.entityType,
            entityId: input.entityId,
            entityRef: input.entityRef ?? null,
            payload: input.payload as any,
          },
        });

        logger.debug(`Audit event appended: ${input.eventType} (seq ${seq}, hash ${hash.substring(0, 8)}...)`);
      });
    } catch (error: any) {
      // Log error but don't throw - audit failures shouldn't break the main flow
      logger.error(`Failed to append audit event: ${error?.message || error}`, error?.stack);
      // In production, you might want to throw or use a dead-letter queue
      // For now, we log and continue to avoid breaking operations
    }
  }
}
