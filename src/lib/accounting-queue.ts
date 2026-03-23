import { db } from "@/lib/db";
import type { AccountingEntityType, AccountingSyncAction, AccountingProvider } from "@prisma/client";

export async function enqueueSync(
  organizationId: string,
  provider: AccountingProvider,
  entityType: AccountingEntityType,
  uplifterEntityId: string,
  action: AccountingSyncAction = "CREATE"
): Promise<void> {
  const connection = await db.accountingConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
    select: { id: true, isActive: true, setupComplete: true },
  });

  if (!connection || !connection.isActive || !connection.setupComplete) {
    return;
  }

  const existing = await db.accountingSyncQueue.findFirst({
    where: {
      connectionId: connection.id,
      entityType,
      uplifterEntityId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (existing) {
    await db.accountingSyncQueue.update({
      where: { id: existing.id },
      data: { action, createdAt: new Date() },
    });
  } else {
    await db.accountingSyncQueue.create({
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

export async function enqueueFullSync(
  organizationId: string,
  provider: AccountingProvider
): Promise<{ queued: number }> {
  const connection = await db.accountingConnection.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
    select: { id: true, isActive: true, setupComplete: true },
  });

  if (!connection || !connection.isActive || !connection.setupComplete) {
    return { queued: 0 };
  }

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
    entityType: AccountingEntityType;
    uplifterEntityId: string;
    action: AccountingSyncAction;
    priority: number;
  }> = [];

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

  for (const inv of invoices) {
    items.push({
      connectionId: connection.id,
      entityType: "INVOICE",
      uplifterEntityId: inv.id,
      action: "CREATE",
      priority: getEntityPriority("INVOICE"),
    });
  }

  for (const pay of payments) {
    items.push({
      connectionId: connection.id,
      entityType: "PAYMENT",
      uplifterEntityId: pay.id,
      action: "CREATE",
      priority: getEntityPriority("PAYMENT"),
    });
  }

  for (const le of ledgerEntries) {
    items.push({
      connectionId: connection.id,
      entityType: "JOURNAL_ENTRY",
      uplifterEntityId: le.id,
      action: "CREATE",
      priority: getEntityPriority("JOURNAL_ENTRY"),
    });
  }

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
    // Clear any existing PENDING items for this connection to avoid duplicates
    // from repeated full-sync triggers (e.g. double-click).
    await db.accountingSyncQueue.deleteMany({
      where: { connectionId: connection.id, status: "PENDING" },
    });
    await db.accountingSyncQueue.createMany({ data: items });
  }

  return { queued: items.length };
}

function getEntityPriority(entityType: AccountingEntityType): number {
  const priorities: Record<AccountingEntityType, number> = {
    ACCOUNT: 0,
    ITEM: 1,
    CUSTOMER: 2,
    INVOICE: 3,
    PAYMENT: 4,
    REFUND: 5,
    JOURNAL_ENTRY: 6,
    DEPOSIT: 7,
  };
  return priorities[entityType] ?? 10;
}
