import { db } from "@/lib/db";
import { getXeroClient, type XeroApiClient } from "@/lib/xero";
import type {
  AccountingConnection,
  AccountingAccountMapping,
  AccountingSyncQueue,
  AccountingEntityType,
} from "@prisma/client";
import { Contact, Invoice as XeroInvoice, CreditNote, BankTransaction, Phone, Address, LineAmountTypes } from "xero-node";
import type { LineItem, Payment as XeroPayment, ManualJournal, ManualJournalLine } from "xero-node";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
const STALE_PROCESSING_MINUTES = 10;

export async function processXeroSyncQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000);
  await db.accountingSyncQueue.updateMany({
    where: {
      status: "PROCESSING",
      OR: [
        { lastAttemptAt: { lt: staleThreshold } },
        { lastAttemptAt: null, createdAt: { lt: staleThreshold } },
      ],
    },
    data: { status: "PENDING" },
  });

  const connections = await db.accountingConnection.findMany({
    where: { provider: "XERO", isActive: true, setupComplete: true },
    include: { accountMappings: true },
  });

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
  let client: XeroApiClient;
  try {
    client = await getXeroClient(connection.id);
  } catch (error) {
    console.error(
      `[Xero Sync] Failed to get client for connection ${connection.id}:`,
      error
    );
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pendingItems = await db.accountingSyncQueue.findMany({
    where: {
      connectionId: connection.id,
      status: "PENDING",
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: BATCH_SIZE,
  });

  let succeeded = 0;
  let failed = 0;

  for (const item of pendingItems) {
    const startTime = Date.now();
    try {
      await db.accountingSyncQueue.update({
        where: { id: item.id },
        data: { status: "PROCESSING", lastAttemptAt: new Date() },
      });

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
  client: XeroApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  item: AccountingSyncQueue
): Promise<string> {
  switch (item.entityType) {
    case "CUSTOMER":
      return syncContact(client, connection, item.uplifterEntityId);
    case "INVOICE":
      return syncInvoice(client, connection, item.uplifterEntityId);
    case "PAYMENT":
      return syncPayment(client, connection, item.uplifterEntityId);
    case "REFUND":
      return syncCreditNote(client, connection, item.uplifterEntityId);
    case "JOURNAL_ENTRY":
      return syncManualJournal(client, connection, item.uplifterEntityId);
    case "DEPOSIT":
      return syncBankTransaction(client, connection, item.uplifterEntityId);
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
  client: XeroApiClient,
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

async function syncContact(
  client: XeroApiClient,
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

  // Check if contact already exists by email
  const existingResponse = await client.accountingApi.getContacts(
    client.tenantId,
    undefined,
    `EmailAddress=="${user.email}"`
  );
  const existingContacts = existingResponse.body?.contacts || [];

  if (existingContacts.length > 0 && existingContacts[0].contactID) {
    return existingContacts[0].contactID;
  }

  const addr = user.billingAddresses[0];
  const contact: Contact = {
    name: user.name,
    emailAddress: user.email,
    ...(user.phone && {
      phones: [{ phoneType: Phone.PhoneTypeEnum.DEFAULT, phoneNumber: user.phone }],
    }),
    ...(addr && {
      addresses: [
        {
          addressType: Address.AddressTypeEnum.STREET,
          addressLine1: addr.street,
          city: addr.city,
          region: addr.stateProvince || undefined,
          postalCode: addr.postalCode,
          country: addr.country,
        },
      ],
    }),
  };

  const response = await client.accountingApi.createContacts(
    client.tenantId,
    { contacts: [contact] }
  );

  const created = response.body?.contacts?.[0];
  if (!created?.contactID) {
    throw new Error("Failed to create Xero contact");
  }

  return created.contactID;
}

async function syncInvoice(
  client: XeroApiClient,
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

  let xeroContactId: string | undefined;
  if (invoice.userId) {
    xeroContactId = await getOrCreateExternalEntityId(
      client,
      connection,
      "CUSTOMER",
      invoice.userId,
      () => syncContact(client, connection, invoice.userId!)
    );
  }

  const lineItems: LineItem[] = invoice.lineItems.map((li) => {
    const glMapping = li.glCodeId
      ? getMapping(connection, "GL_CODE", li.glCodeId)
      : undefined;

    return {
      description: li.description,
      quantity: li.quantity,
      unitAmount: Number(li.unitPrice),
      ...(glMapping && {
        accountCode: glMapping.externalAccountId,
      }),
    };
  });

  const xeroInvoice: XeroInvoice = {
    type: XeroInvoice.TypeEnum.ACCREC,
    contact: xeroContactId ? { contactID: xeroContactId } : { name: "Unknown Customer" },
    lineItems,
    date: formatDate(invoice.createdAt),
    dueDate: formatDate(invoice.dueDate),
    reference: invoice.reference,
    status: XeroInvoice.StatusEnum.AUTHORISED,
    lineAmountTypes: LineAmountTypes.Exclusive,
  };

  const response = await client.accountingApi.createInvoices(
    client.tenantId,
    { invoices: [xeroInvoice] }
  );

  const created = response.body?.invoices?.[0];
  if (!created?.invoiceID) {
    throw new Error("Failed to create Xero invoice");
  }

  return created.invoiceID;
}

async function syncPayment(
  client: XeroApiClient,
  connection: AccountingConnection & { accountMappings: AccountingAccountMapping[] },
  paymentId: string
): Promise<string> {
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });

  if (!payment) throw new Error(`Payment ${paymentId} not found`);

  let xeroInvoiceId: string | undefined;
  if (payment.invoiceId) {
    xeroInvoiceId = await getOrCreateExternalEntityId(
      client,
      connection,
      "INVOICE",
      payment.invoiceId,
      () => syncInvoice(client, connection, payment.invoiceId!)
    );
  }

  if (!xeroInvoiceId) {
    throw new Error(`Cannot create Xero payment without an invoice`);
  }

  const bankMapping = getMapping(connection, "BANK_ACCOUNT");
  const undepositedFunds = getMapping(connection, "UNDEPOSITED_FUNDS");
  const accountId = undepositedFunds?.externalAccountId || bankMapping?.externalAccountId;

  if (!accountId) {
    throw new Error("No bank or undeposited funds account mapping for payments");
  }

  const xeroPayment: XeroPayment = {
    invoice: { invoiceID: xeroInvoiceId },
    account: { accountID: accountId },
    amount: Number(payment.amount),
    date: formatDate(payment.processedAt || payment.createdAt),
  };

  const response = await client.accountingApi.createPayment(
    client.tenantId,
    xeroPayment
  );

  const created = response.body?.payments?.[0];
  if (!created?.paymentID) {
    throw new Error("Failed to create Xero payment");
  }

  return created.paymentID;
}

async function syncCreditNote(
  client: XeroApiClient,
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

  let xeroContactId: string | undefined;
  if (transaction.payment?.userId) {
    xeroContactId = await getOrCreateExternalEntityId(
      client,
      connection,
      "CUSTOMER",
      transaction.payment.userId,
      () => syncContact(client, connection, transaction.payment!.userId!)
    );
  }

  const refundsMapping = getMapping(connection, "REFUNDS");

  const creditNote: CreditNote = {
    type: CreditNote.TypeEnum.ACCRECCREDIT,
    contact: xeroContactId ? { contactID: xeroContactId } : { name: "Unknown Customer" },
    date: formatDate(transaction.createdAt),
    lineItems: [
      {
        description: `Refund - ${transaction.description || transaction.pspReference}`,
        unitAmount: Number(transaction.amount),
        quantity: 1,
        ...(refundsMapping && {
          accountCode: refundsMapping.externalAccountId,
        }),
      },
    ],
    status: CreditNote.StatusEnum.AUTHORISED,
  };

  const response = await client.accountingApi.createCreditNotes(
    client.tenantId,
    { creditNotes: [creditNote] }
  );

  const created = response.body?.creditNotes?.[0];
  if (!created?.creditNoteID) {
    throw new Error("Failed to create Xero credit note");
  }

  return created.creditNoteID;
}

async function syncManualJournal(
  client: XeroApiClient,
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
    throw new Error(
      `No account mapping for GL code ${entry.glCode.code} (${entry.glCodeId})`
    );
  }

  const journalLines: ManualJournalLine[] = [];

  if (entry.debit && Number(entry.debit) > 0) {
    journalLines.push({
      lineAmount: Number(entry.debit),
      accountCode: glMapping.externalAccountId,
      description: entry.description || `Debit - ${entry.reference}`,
    });
  }

  if (entry.credit && Number(entry.credit) > 0) {
    journalLines.push({
      lineAmount: -Number(entry.credit),
      accountCode: glMapping.externalAccountId,
      description: entry.description || `Credit - ${entry.reference}`,
    });
  }

  const journal: ManualJournal = {
    narration: entry.description || `Journal Entry ${entry.reference}`,
    date: formatDate(entry.date),
    journalLines,
  };

  const response = await client.accountingApi.createManualJournals(
    client.tenantId,
    { manualJournals: [journal] }
  );

  const created = response.body?.manualJournals?.[0];
  if (!created?.manualJournalID) {
    throw new Error("Failed to create Xero manual journal");
  }

  return created.manualJournalID;
}

async function syncBankTransaction(
  client: XeroApiClient,
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

  if (!bankMapping) {
    throw new Error("No bank account mapping configured for deposits");
  }

  const lineItems: LineItem[] = [
    {
      description: `Payout ${payout.reference}`,
      unitAmount: Number(payout.amount),
      quantity: 1,
      accountCode: bankMapping.externalAccountId,
    },
  ];

  if (Number(payout.fees) > 0 && feesMapping) {
    lineItems.push({
      description: `Processing fees for payout ${payout.reference}`,
      unitAmount: -Number(payout.fees),
      quantity: 1,
      accountCode: feesMapping.externalAccountId,
    });
  }

  const bankTransaction: BankTransaction = {
    type: BankTransaction.TypeEnum.RECEIVE,
    contact: { name: "Payment Processor (Adyen)" },
    bankAccount: { accountID: bankMapping.externalAccountId },
    lineItems,
    date: formatDate(payout.paidAt || payout.createdAt),
    reference: payout.reference,
  };

  const response = await client.accountingApi.createBankTransactions(
    client.tenantId,
    { bankTransactions: [bankTransaction] }
  );

  const created = response.body?.bankTransactions?.[0];
  if (!created?.bankTransactionID) {
    throw new Error("Failed to create Xero bank transaction");
  }

  return created.bankTransactionID;
}
