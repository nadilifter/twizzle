import { db } from "@/lib/db";
import type { QboEntityType, QboSyncAction } from "@prisma/client";

/**
 * Queue an entity for sync to QuickBooks Online.
 * Deduplicates by (connectionId, entityType, uplifterEntityId) — if a PENDING
 * entry already exists, it is updated rather than duplicated.
 */
export async function enqueueSync(
  organizationId: string,
  entityType: QboEntityType,
  uplifterEntityId: string,
  action: QboSyncAction = "CREATE"
): Promise<void> {
  const connection = await db.qboConnection.findUnique({
    where: { organizationId },
    select: { id: true, isActive: true, setupComplete: true },
  });

  if (!connection || !connection.isActive || !connection.setupComplete) {
    return;
  }

  // Upsert: if a PENDING item already exists for this entity, update it
  const existing = await db.qboSyncQueue.findFirst({
    where: {
      connectionId: connection.id,
      entityType,
      uplifterEntityId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existing) {
    await db.qboSyncQueue.update({
      where: { id: existing.id },
      data: { action, createdAt: new Date() },
    });
  } else {
    await db.qboSyncQueue.create({
      data: {
        connectionId: connection.id,
        entityType,
        uplifterEntityId,
        action,
        priority: getEntityPriority(entityType),
      },
    });
  }
}

/**
 * Queue all existing entities for an initial full sync.
 * Called when a gym first completes their account mapping setup.
 */
export async function enqueueFullSync(
  organizationId: string
): Promise<{ queued: number }> {
  const connection = await db.qboConnection.findUnique({
    where: { organizationId },
    select: { id: true, isActive: true, setupComplete: true },
  });

  if (!connection || !connection.isActive || !connection.setupComplete) {
    return { queued: 0 };
  }

  // Fetch all entity IDs to sync, in dependency order
  const [users, invoices, payments, ledgerEntries, payouts] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.invoice.findMany({
      where: { organizationId, status: { not: "DRAFT" } },
      select: { id: true },
    }),
    db.payment.findMany({
      where: { invoice: { organizationId }, status: "COMPLETED" },
      select: { id: true },
    }),
    db.ledgerEntry.findMany({
      where: { organizationId, status: "POSTED" },
      select: { id: true },
    }),
    db.payout.findMany({
      where: { organizationId, status: "PAID" },
      select: { id: true },
    }),
  ]);

  const items: Array<{
    connectionId: string;
    entityType: QboEntityType;
    uplifterEntityId: string;
    action: QboSyncAction;
    priority: number;
  }> = [];

  // Customers (unique users who have invoices)
  const uniqueUserIds = [...new Set(users.map((u) => u.userId).filter(Boolean))] as string[];
  for (const userId of uniqueUserIds) {
    items.push({
      connectionId: connection.id,
      entityType: "CUSTOMER",
      uplifterEntityId: userId,
      action: "CREATE",
      priority: getEntityPriority("CUSTOMER"),
    });
  }

  // Invoices
  for (const inv of invoices) {
    items.push({
      connectionId: connection.id,
      entityType: "INVOICE",
      uplifterEntityId: inv.id,
      action: "CREATE",
      priority: getEntityPriority("INVOICE"),
    });
  }

  // Payments
  for (const pay of payments) {
    items.push({
      connectionId: connection.id,
      entityType: "PAYMENT",
      uplifterEntityId: pay.id,
      action: "CREATE",
      priority: getEntityPriority("PAYMENT"),
    });
  }

  // Journal Entries
  for (const le of ledgerEntries) {
    items.push({
      connectionId: connection.id,
      entityType: "JOURNAL_ENTRY",
      uplifterEntityId: le.id,
      action: "CREATE",
      priority: getEntityPriority("JOURNAL_ENTRY"),
    });
  }

  // Deposits
  for (const po of payouts) {
    items.push({
      connectionId: connection.id,
      entityType: "DEPOSIT",
      uplifterEntityId: po.id,
      action: "CREATE",
      priority: getEntityPriority("DEPOSIT"),
    });
  }

  if (items.length > 0) {
    await db.qboSyncQueue.createMany({ data: items });
  }

  return { queued: items.length };
}

/**
 * Priority determines processing order within a cron run.
 * Lower number = processed first. Ensures dependencies are met.
 */
function getEntityPriority(entityType: QboEntityType): number {
  const priorities: Record<QboEntityType, number> = {
    ACCOUNT: 0,
    ITEM: 1,
    CUSTOMER: 2,
    INVOICE: 3,
    PAYMENT: 4,
    REFUND_RECEIPT: 5,
    JOURNAL_ENTRY: 6,
    DEPOSIT: 7,
  };
  return priorities[entityType] ?? 10;
}
