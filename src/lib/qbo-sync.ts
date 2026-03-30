import { db } from "@/lib/db";
import { getQboClient, type QboApiClient } from "@/lib/qbo";
import { Prisma } from "@prisma/client";
import type {
  AccountingConnection,
  AccountingAccountMapping,
  AccountingSyncQueue,
  AccountingEntityType,
} from "@prisma/client";
import { createHash } from "crypto";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const STALE_PROCESSING_MINUTES = 10;

export async function processQboSyncQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const connections = await db.accountingConnection.findMany({
    where: { provider: "QBO", isActive: true, setupComplete: true },
    include: { accountMappings: true },
  });

  if (connections.length > 0) {
    const connectionIds = connections.map((c) => c.id);
    const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);
    await db.accountingSyncQueue.updateMany({
      where: {
        connectionId: { in: connectionIds },
        status: "PROCESSING",
        OR: [
          { lastAttemptAt: { lt: staleThreshold } },
          { lastAttemptAt: null, createdAt: { lt: staleThreshold } },
        ],
      },
      data: { status: "PENDING" },
    });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const connection of connections) {
    const result = await processConnectionQueue(connection);
    processed += result.processed;
    succeeded += result.succeeded;
    failed += result.failed;
  }

  return { processed, succeeded, failed };
}

async function processConnectionQueue(
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] }
): Promise<{ processed: number; succeeded: number; failed: number }> {
  let client: QboApiClient;
  try {
    client = await getQboClient(connection.id);
  } catch (error) {
    console.error(`[QBO Sync] Failed to get client for connection ${connection.id}:`, error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Atomically claim a batch of PENDING items using FOR UPDATE SKIP LOCKED
  // so concurrent cron invocations never process the same item.
  const pendingItems = await db.$queryRaw<AccountingSyncQueue[]>(Prisma.sql`
    UPDATE "AccountingSyncQueue"
    SET status = 'PROCESSING', "lastAttemptAt" = NOW()
    WHERE id IN (
      SELECT id FROM "AccountingSyncQueue"
      WHERE "connectionId" = ${connection.id}
        AND status = 'PENDING'
        AND attempts < ${MAX_ATTEMPTS}
      ORDER BY priority ASC, "createdAt" ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const startTime = Date.now();
    try {
      const externalEntityId = await syncEntity(client, connection, item);

      await db.accountingSyncQueue.update({
        where: { id: item.id },
        data: { status: "COMPLETED" },
      });

      await db.accountingSyncMapping.upsert({
        where: {
          connectionId_entityType_uplifterEntityId: {
            connectionId: connection.id,
            entityType: item.entityType,
            uplifterEntityId: item.uplifterEntityId,
          },
        },
        create: {
          connectionId: connection.id,
          entityType: item.entityType,
          uplifterEntityId: item.uplifterEntityId,
          externalEntityId,
          lastSyncedAt: new Date(),
        },
        update: {
          externalEntityId,
          lastSyncedAt: new Date(),
        },
      });

      await db.accountingSyncLog.create({
        data: {
          connectionId: connection.id,
          entityType: item.entityType,
          uplifterEntityId: item.uplifterEntityId,
          action: item.action,
          status: "COMPLETED",
          externalEntityId,
          durationMs: Date.now() - startTime,
        },
      });

      succeeded++;
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";

      await db.accountingSyncQueue.update({
        where: { id: item.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          errorMessage,
        },
      });

      if (item.attempts + 1 < MAX_ATTEMPTS) {
        await db.accountingSyncQueue.update({
          where: { id: item.id },
          data: { status: "PENDING" },
        });
      }

      await db.accountingSyncLog.create({
        data: {
          connectionId: connection.id,
          entityType: item.entityType,
          uplifterEntityId: item.uplifterEntityId,
          action: item.action,
          status: "FAILED",
          errorMessage,
          durationMs: Date.now() - startTime,
        },
      });

      failed++;
    }
  }

  if (pendingItems.length > 0) {
    await db.accountingConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });
  }

  return { processed: pendingItems.length, succeeded, failed };
}

async function syncEntity(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  item: AccountingSyncQueue
): Promise<string> {
  switch (item.entityType) {
    case "CUSTOMER":
      return syncCustomer(client, connection, item.uplifterEntityId);
    case "INVOICE":
      return syncInvoice(client, connection, item.uplifterEntityId);
    case "PAYMENT":
      return syncPayment(client, connection, item.uplifterEntityId);
    case "REFUND":
      return syncRefund(client, connection, item.uplifterEntityId);
    case "JOURNAL_ENTRY":
      return syncJournalEntry(client, connection, item.uplifterEntityId);
    case "DEPOSIT":
      return syncDeposit(client, connection, item.uplifterEntityId);
    default:
      throw new Error(`Unsupported entity type: ${item.entityType}`);
  }
}

function getMapping(
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  mappingType: string,
  uplifterEntityId?: string | null
): AccountingAccountMapping | undefined {
  return connection.accountMappings.find(
    (m) =>
      m.mappingType === mappingType &&
      (uplifterEntityId ? m.uplifterEntityId === uplifterEntityId : !m.uplifterEntityId)
  );
}

async function getOrCreateExternalEntityId(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  entityType: AccountingEntityType,
  uplifterEntityId: string,
  syncFn: () => Promise<string>
): Promise<string> {
  const existing = await db.accountingSyncMapping.findUnique({
    where: {
      connectionId_entityType_uplifterEntityId: {
        connectionId: connection.id,
        entityType,
        uplifterEntityId,
      },
    },
  });

  if (existing) return existing.externalEntityId;

  const externalId = await syncFn();

  await db.accountingSyncMapping.upsert({
    where: {
      connectionId_entityType_uplifterEntityId: {
        connectionId: connection.id,
        entityType,
        uplifterEntityId,
      },
    },
    create: {
      connectionId: connection.id,
      entityType,
      uplifterEntityId,
      externalEntityId: externalId,
      lastSyncedAt: new Date(),
    },
    update: { externalEntityId: externalId, lastSyncedAt: new Date() },
  });

  return externalId;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function syncCustomer(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  userId: string
): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      billingAddresses: { where: { isPrimary: true }, take: 1 },
    },
  });

  if (!user) throw new Error(`User ${userId} not found`);

  const existingCustomers = await client.query<any>(
    `SELECT Id FROM Customer WHERE PrimaryEmailAddr = '${user.email.replace(/'/g, "\\'")}'`
  );

  if (existingCustomers.length > 0) {
    return existingCustomers[0].Id;
  }

  const addr = user.billingAddresses[0];
  const customerData: any = {
    DisplayName: user.name,
    PrimaryEmailAddr: { Address: user.email },
    ...(user.phone && { PrimaryPhone: { FreeFormNumber: user.phone } }),
    ...(addr && {
      BillAddr: {
        Line1: addr.street,
        City: addr.city,
        CountrySubDivisionCode: addr.stateProvince || undefined,
        PostalCode: addr.postalCode,
        Country: addr.country,
      },
    }),
  };

  const result = await client.post("customer", customerData);
  return result.Customer.Id;
}

async function syncInvoice(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  invoiceId: string
): Promise<string> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lineItems: { include: { glCode: true } },
      user: true,
    },
  });

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

  let qboCustomerId: string | undefined;
  if (invoice.userId) {
    qboCustomerId = await getOrCreateExternalEntityId(
      client,
      connection,
      "CUSTOMER",
      invoice.userId,
      () => syncCustomer(client, connection, invoice.userId!)
    );
  }

  const lines = invoice.lineItems.map((li) => {
    const glMapping = li.glCodeId ? getMapping(connection, "GL_CODE", li.glCodeId) : undefined;

    const line: any = {
      Amount: Number(li.total),
      DetailType: "SalesItemLineDetail",
      Description: li.description,
      SalesItemLineDetail: {
        Qty: li.quantity,
        UnitPrice: Number(li.unitPrice),
        ...(glMapping && {
          ItemAccountRef: {
            value: glMapping.externalAccountId,
            name: glMapping.externalAccountName,
          },
        }),
      },
    };
    return line;
  });

  const invoiceData: any = {
    Line: lines,
    DueDate: formatDate(invoice.dueDate),
    DocNumber: invoice.reference,
    ...(qboCustomerId && {
      CustomerRef: { value: qboCustomerId },
    }),
    ...(invoice.notes && {
      CustomerMemo: { value: invoice.notes },
    }),
    ...(Number(invoice.tax) > 0 && {
      TxnTaxDetail: {
        TotalTax: Number(invoice.tax),
      },
    }),
  };

  const result = await client.post("invoice", invoiceData);
  return result.Invoice.Id;
}

async function syncPayment(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  paymentId: string
): Promise<string> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });

  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  let qboInvoiceId: string | undefined;
  if (payment.invoiceId) {
    qboInvoiceId = await getOrCreateExternalEntityId(
      client,
      connection,
      "INVOICE",
      payment.invoiceId,
      () => syncInvoice(client, connection, payment.invoiceId!)
    );
  }

  let qboCustomerId: string | undefined;
  if (payment.userId) {
    qboCustomerId = await getOrCreateExternalEntityId(
      client,
      connection,
      "CUSTOMER",
      payment.userId,
      () => syncCustomer(client, connection, payment.userId!)
    );
  }

  const undepositedFunds = getMapping(connection, "UNDEPOSITED_FUNDS");

  const paymentData: any = {
    TotalAmt: Number(payment.amount),
    ...(qboCustomerId && {
      CustomerRef: { value: qboCustomerId },
    }),
    ...(payment.processedAt && {
      TxnDate: formatDate(payment.processedAt),
    }),
    ...(undepositedFunds && {
      DepositToAccountRef: { value: undepositedFunds.externalAccountId },
    }),
    ...(qboInvoiceId && {
      Line: [
        {
          Amount: Number(payment.amount),
          LinkedTxn: [
            {
              TxnId: qboInvoiceId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    }),
  };

  const result = await client.post("payment", paymentData);
  return result.Payment.Id;
}

async function syncRefund(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  transactionId: string
): Promise<string> {
  const transaction = await db.transaction.findUnique({
    where: { id: transactionId },
    include: {
      payment: { include: { invoice: { include: { lineItems: true } } } },
    },
  });

  if (!transaction) throw new Error(`Transaction ${transactionId} not found`);

  let qboCustomerId: string | undefined;
  if (transaction.payment?.userId) {
    qboCustomerId = await getOrCreateExternalEntityId(
      client,
      connection,
      "CUSTOMER",
      transaction.payment.userId,
      () => syncCustomer(client, connection, transaction.payment!.userId!)
    );
  }

  const refundsMapping = getMapping(connection, "REFUNDS");

  const refundData: any = {
    TotalAmt: Number(transaction.amount),
    ...(qboCustomerId && {
      CustomerRef: { value: qboCustomerId },
    }),
    TxnDate: formatDate(transaction.createdAt),
    Line: [
      {
        Amount: Number(transaction.amount),
        DetailType: "SalesItemLineDetail",
        Description: `Refund - ${transaction.description || transaction.pspReference}`,
        SalesItemLineDetail: {
          ...(refundsMapping && {
            ItemAccountRef: {
              value: refundsMapping.externalAccountId,
              name: refundsMapping.externalAccountName,
            },
          }),
        },
      },
    ],
  };

  const result = await client.post("refundreceipt", refundData);
  return result.RefundReceipt.Id;
}

async function syncJournalEntry(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  ledgerEntryId: string
): Promise<string> {
  const entry = await db.ledgerEntry.findUnique({
    where: { id: ledgerEntryId },
    include: { glCode: true },
  });

  if (!entry) throw new Error(`LedgerEntry ${ledgerEntryId} not found`);

  const glMapping = getMapping(connection, "GL_CODE", entry.glCodeId);
  if (!glMapping) {
    throw new Error(`No account mapping for GL code ${entry.glCode.code} (${entry.glCodeId})`);
  }

  const lines: any[] = [];

  if (entry.debit && Number(entry.debit) > 0) {
    lines.push({
      Amount: Number(entry.debit),
      DetailType: "JournalEntryLineDetail",
      Description: entry.description,
      JournalEntryLineDetail: {
        PostingType: "Debit",
        AccountRef: {
          value: glMapping.externalAccountId,
          name: glMapping.externalAccountName,
        },
      },
    });
  }

  if (entry.credit && Number(entry.credit) > 0) {
    lines.push({
      Amount: Number(entry.credit),
      DetailType: "JournalEntryLineDetail",
      Description: entry.description,
      JournalEntryLineDetail: {
        PostingType: "Credit",
        AccountRef: {
          value: glMapping.externalAccountId,
          name: glMapping.externalAccountName,
        },
      },
    });
  }

  const jeData: any = {
    Line: lines,
    TxnDate: formatDate(entry.date),
    ...(entry.reference && { DocNumber: entry.reference }),
  };

  const result = await client.post("journalentry", jeData);
  return result.JournalEntry.Id;
}

async function syncDeposit(
  client: QboApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  payoutId: string
): Promise<string> {
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      transactions: {
        where: { type: "PAYMENT" },
        include: { payment: true },
      },
    },
  });

  if (!payout) throw new Error(`Payout ${payoutId} not found`);

  const bankMapping = getMapping(connection, "BANK_ACCOUNT");
  const feesMapping = getMapping(connection, "PROCESSING_FEES");
  const undepositedFunds = getMapping(connection, "UNDEPOSITED_FUNDS");

  if (!bankMapping) {
    throw new Error("No bank account mapping configured for deposits");
  }

  const lines: any[] = [];

  for (const txn of payout.transactions) {
    if (!txn.payment) continue;

    const syncMapping = await db.accountingSyncMapping.findUnique({
      where: {
        connectionId_entityType_uplifterEntityId: {
          connectionId: connection.id,
          entityType: "PAYMENT",
          uplifterEntityId: txn.payment.id,
        },
      },
    });

    if (syncMapping) {
      lines.push({
        Amount: Number(txn.amount),
        LinkedTxn: [
          {
            TxnId: syncMapping.externalEntityId,
            TxnType: "Payment",
          },
        ],
      });
    }
  }

  if (lines.length === 0) {
    lines.push({
      Amount: Number(payout.amount),
      DetailType: "DepositLineDetail",
      Description: `Payout ${payout.reference}`,
      DepositLineDetail: {
        AccountRef: undepositedFunds ? { value: undepositedFunds.externalAccountId } : undefined,
      },
    });
  }

  const depositData: any = {
    DepositToAccountRef: { value: bankMapping.externalAccountId },
    TxnDate: formatDate(payout.paidAt || payout.createdAt),
    Line: lines,
    ...(Number(payout.fees) > 0 &&
      feesMapping && {
        CashBack: {
          Amount: Number(payout.fees),
          AccountRef: { value: feesMapping.externalAccountId },
        },
      }),
  };

  const result = await client.post("deposit", depositData);
  return result.Deposit.Id;
}
