import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";

/** Append-only audit trail for admin/moderation and other sensitive actions (CLAUDE.md §9b). */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = prisma,
): Promise<void> {
  await tx.auditLog.create({ data: { actorId, action, entity, entityId, metadata } });
}
