/**
 * Adyen Platform API Client (Balance Platform / Marketplace)
 *
 * Wraps LEM, Configuration, and Management APIs using two separate credential scopes:
 *   - ADYEN_LEM_API_KEY: Legal Entity Management (legal entities, business lines, onboarding)
 *   - ADYEN_PLATFORM_API_KEY: Configuration + Management (account holders, balance accounts, stores)
 *
 * Follows the same lazy-initialization pattern as src/lib/adyen.ts.
 */

import type { BalanceAccount } from "@adyen/api-library/lib/src/typings/balancePlatform/balanceAccount";
import type { Balance } from "@adyen/api-library/lib/src/typings/balancePlatform/balance";

// Platform is USD-only; update alongside multi-currency support if added
const PLATFORM_CURRENCY = "USD";

let _lemClient: any = null;
let _platformClient: any = null;
let _lemApi: any = null;
let _configApi: any = null;
let _managementApi: any = null;

export function isPlatformConfigured(): boolean {
  return !!(
    process.env.ADYEN_BALANCE_PLATFORM &&
    process.env.ADYEN_PLATFORM_API_KEY &&
    process.env.ADYEN_LEM_API_KEY
  );
}

function getLemClient() {
  if (_lemClient) return _lemClient;

  const apiKey = process.env.ADYEN_LEM_API_KEY;
  if (!apiKey) {
    throw new Error("ADYEN_LEM_API_KEY is not set. Required for Legal Entity Management API.");
  }

  const { Client } = require("@adyen/api-library");
  _lemClient = new Client({
    apiKey,
    environment: process.env.ADYEN_ENVIRONMENT?.toUpperCase() === "LIVE" ? "LIVE" : "TEST",
  });
  return _lemClient;
}

function getPlatformClient() {
  if (_platformClient) return _platformClient;

  const apiKey = process.env.ADYEN_PLATFORM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ADYEN_PLATFORM_API_KEY is not set. Required for Configuration and Management APIs."
    );
  }

  const { Client } = require("@adyen/api-library");
  _platformClient = new Client({
    apiKey,
    environment: process.env.ADYEN_ENVIRONMENT?.toUpperCase() === "LIVE" ? "LIVE" : "TEST",
  });
  return _platformClient;
}

function getLemApi() {
  if (_lemApi) return _lemApi;
  const { LegalEntityManagementAPI } = require("@adyen/api-library");
  _lemApi = new LegalEntityManagementAPI(getLemClient());
  return _lemApi;
}

function getConfigApi() {
  if (_configApi) return _configApi;
  const { BalancePlatformAPI } = require("@adyen/api-library");
  _configApi = new BalancePlatformAPI(getPlatformClient());
  return _configApi;
}

let _managementClient: any = null;

function getManagementClient() {
  if (_managementClient) return _managementClient;

  const apiKey = process.env.ADYEN_API_KEY;
  if (!apiKey) {
    throw new Error("ADYEN_API_KEY is not set. Required for Management API (stores).");
  }

  const { Client } = require("@adyen/api-library");
  _managementClient = new Client({
    apiKey,
    environment: process.env.ADYEN_ENVIRONMENT?.toUpperCase() === "LIVE" ? "LIVE" : "TEST",
  });
  return _managementClient;
}

function getManagementApi() {
  if (_managementApi) return _managementApi;
  const { ManagementAPI } = require("@adyen/api-library");
  _managementApi = new ManagementAPI(getManagementClient());
  return _managementApi;
}

// ---------------------------------------------------------------------------
// Legal Entity Management
// ---------------------------------------------------------------------------

export async function createLegalEntity(data: {
  type: "organization";
  organization: {
    legalName: string;
    registeredAddress: {
      street: string;
      city: string;
      stateOrProvince: string;
      postalCode: string;
      country: string;
    };
  };
}): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getLemApi().LegalEntitiesApi.createLegalEntity(data);
  } catch (error: any) {
    console.error("adyen-platform: createLegalEntity failed", {
      legalName: data.organization.legalName,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function getLegalEntity(
  legalEntityId: string
): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getLemApi().LegalEntitiesApi.getLegalEntity(legalEntityId);
  } catch (error: any) {
    console.error("adyen-platform: getLegalEntity failed", {
      legalEntityId,
      status: error.statusCode,
    });
    throw error;
  }
}

export async function createBusinessLine(data: {
  legalEntityId: string;
  industryCode: string;
  service: "paymentProcessing";
  salesChannels: string[];
  webData?: Array<{ webAddress: string }>;
}): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getLemApi().BusinessLinesApi.createBusinessLine(data);
  } catch (error: any) {
    console.error("adyen-platform: createBusinessLine failed", {
      legalEntityId: data.legalEntityId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function generateOnboardingLink(
  legalEntityId: string,
  redirectUrl: string,
  themeId?: string
): Promise<{ url: string; [key: string]: any }> {
  try {
    const resolvedThemeId = themeId || process.env.ADYEN_ONBOARDING_THEME_ID;
    const linkInfo: any = { redirectUrl };
    if (resolvedThemeId) {
      linkInfo.themeId = resolvedThemeId;
    }
    return await getLemApi().HostedOnboardingApi.getLinkToAdyenhostedOnboardingPage(
      legalEntityId,
      linkInfo
    );
  } catch (error: any) {
    console.error("adyen-platform: generateOnboardingLink failed", {
      legalEntityId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Configuration (Balance Platform) API
// ---------------------------------------------------------------------------

const DEFAULT_CAPABILITIES = {
  receivePayments: { requested: true, requestedLevel: "notApplicable" },
  sendToTransferInstrument: { requested: true, requestedLevel: "notApplicable" },
  receiveFromBalanceAccount: { requested: true, requestedLevel: "notApplicable" },
};

export async function createAccountHolder(data: {
  legalEntityId: string;
  description?: string;
  capabilities?: Record<string, { requested: boolean; requestedLevel: string }>;
}): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().AccountHoldersApi.createAccountHolder({
      ...data,
      balancePlatform: process.env.ADYEN_BALANCE_PLATFORM,
      capabilities: data.capabilities ?? DEFAULT_CAPABILITIES,
    });
  } catch (error: any) {
    console.error("adyen-platform: createAccountHolder failed", {
      legalEntityId: data.legalEntityId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function getAccountHolder(
  accountHolderId: string
): Promise<{ id: string; capabilities: any; [key: string]: any }> {
  try {
    return await getConfigApi().AccountHoldersApi.getAccountHolder(accountHolderId);
  } catch (error: any) {
    console.error("adyen-platform: getAccountHolder failed", {
      accountHolderId,
      status: error.statusCode,
    });
    throw error;
  }
}

export type PlatformBalance = {
  available: number;
  pending: number;
  reserved: number;
  balance: number;
  currency: string;
};

export async function getBalanceAccountBalance(
  balanceAccountId: string
): Promise<PlatformBalance | null> {
  try {
    const result: BalanceAccount =
      await getConfigApi().BalanceAccountsApi.getBalanceAccount(balanceAccountId);
    const balance = result.balances?.find((b: Balance) => b.currency === "USD");
    if (!balance) {
      console.warn("adyen-platform: getBalanceAccountBalance no USD balance entry", {
        balanceAccountId,
        availableCurrencies: result.balances?.map((b: Balance) => b.currency),
        rawBalances: result.balances,
      });
      return null;
    }
    return {
      available: balance.available / 100,
      pending: (balance.pending ?? 0) / 100,
      reserved: (balance.reserved ?? 0) / 100,
      balance: balance.balance / 100,
      currency: balance.currency,
    };
  } catch (error: any) {
    console.error("adyen-platform: getBalanceAccountBalance failed", {
      balanceAccountId,
      error,
    });
    return null;
  }
}

export async function createBalanceAccount(data: {
  accountHolderId: string;
  description?: string;
}): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().BalanceAccountsApi.createBalanceAccount({
      ...data,
      defaultCurrencyCode: "USD",
      description: data.description || `Balance account for ${data.accountHolderId}`,
    });
  } catch (error: any) {
    console.error("adyen-platform: createBalanceAccount failed", {
      accountHolderId: data.accountHolderId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function createSweep(
  balanceAccountId: string,
  data: {
    counterparty: { transferInstrumentId: string };
    category: "bank";
    type: "push";
    schedule: { type: string };
    priorities: string[];
    currency: string;
  }
): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().BalanceAccountsApi.createSweep(balanceAccountId, data);
  } catch (error: any) {
    console.error("adyen-platform: createSweep failed", {
      balanceAccountId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function updateSweep(
  balanceAccountId: string,
  sweepId: string,
  schedule: { type: "daily" | "weekly" | "monthly" }
): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().BalanceAccountsApi.updateSweep(balanceAccountId, sweepId, {
      schedule,
    });
  } catch (error: any) {
    console.error("adyen-platform: updateSweep failed", {
      balanceAccountId,
      sweepId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function setSweepStatus(
  balanceAccountId: string,
  sweepId: string,
  status: "active" | "inactive"
): Promise<void> {
  try {
    const existing = await getConfigApi().BalanceAccountsApi.getSweep(balanceAccountId, sweepId);
    await getConfigApi().BalanceAccountsApi.updateSweep(balanceAccountId, sweepId, {
      ...existing,
      status: status as any,
    });
  } catch (error: any) {
    console.error("adyen-platform: setSweepStatus failed", {
      balanceAccountId,
      sweepId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Transfers API (list transfers by balance account)
// ---------------------------------------------------------------------------

let _transfersApi: any = null;

function getTransfersApi() {
  if (_transfersApi) return _transfersApi;
  const { TransfersAPI } = require("@adyen/api-library");
  _transfersApi = new TransfersAPI(getPlatformClient());
  return _transfersApi;
}

export async function initiateTransfer(
  balanceAccountId: string,
  transferInstrumentId: string,
  amount: { value: number; currency: string },
  reference: string,
  idempotencyKey: string
): Promise<{ id: string; status: string; [key: string]: any }> {
  try {
    return await getTransfersApi().TransfersApi.transferFunds(
      {
        balanceAccountId,
        category: "bank",
        priority: "regular",
        counterparty: { transferInstrumentId },
        amount,
        reference,
        description: "Manual payout",
      },
      { idempotencyKey }
    );
  } catch (error: any) {
    console.error("adyen-platform: initiateTransfer failed", {
      balanceAccountId,
      transferInstrumentId,
      amount,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function getBalanceAccountSweepDescription(
  balanceAccountId: string,
  sweepId: string
): Promise<string | null> {
  try {
    const sweep = await getConfigApi().BalanceAccountsApi.getSweep(balanceAccountId, sweepId);
    return sweep?.description ?? null;
  } catch {
    return null;
  }
}

export async function getSweepSchedule(
  balanceAccountId: string,
  sweepId: string
): Promise<"daily" | "weekly" | "monthly" | null> {
  try {
    const sweep = await getConfigApi().BalanceAccountsApi.getSweep(balanceAccountId, sweepId);
    const type = sweep?.schedule?.type;
    if (type === "daily" || type === "weekly" || type === "monthly") {
      return type;
    }
    return null;
  } catch (error: any) {
    console.error("adyen-platform: getSweepSchedule failed", {
      balanceAccountId,
      sweepId,
      status: error.statusCode,
      body: error.responseBody,
    });
    return null;
  }
}

export async function listBalanceAccountTransfers(
  balanceAccountId: string,
  opts?: {
    createdSince?: Date;
    createdUntil?: Date;
    category?: "bank" | "internal" | "platformPayment" | "issuedCard" | "platform" | "all";
  }
): Promise<any[]> {
  try {
    const createdSince = opts?.createdSince ?? new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const createdUntil = opts?.createdUntil ?? new Date();
    const categoryFilter = opts?.category ?? "bank";
    const categoryParam = categoryFilter === "all" ? undefined : categoryFilter;
    const allTransfers: any[] = [];
    let cursor: string | undefined;

    do {
      const response = await getTransfersApi().TransfersApi.getAllTransfers(
        createdSince,
        createdUntil,
        undefined, // balancePlatform
        undefined, // accountHolderId
        balanceAccountId,
        undefined, // paymentInstrumentId
        undefined, // reference
        categoryParam, // category
        "asc",
        cursor,
        100 // max per page
      );
      allTransfers.push(...(response.data ?? []));
      const nextHref = response._links?.next?.href;
      cursor = nextHref ? (new URL(nextHref).searchParams.get("cursor") ?? undefined) : undefined;
    } while (cursor);

    return allTransfers;
  } catch (error: any) {
    console.error("adyen-platform: listBalanceAccountTransfers failed", {
      balanceAccountId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export interface AdyenPlatformPayment {
  pspReference: string;
  modificationPspReference?: string;
  amount: number; // net to org's balance account (settlement amount, in dollars)
  currency: string;
  settledAt: Date;
  method?: string;
  description?: string;
  merchantRef?: string;
  adyenFeeAmount: number; // Adyen processing fees deducted for this payment (in dollars, exact from Adyen)
  commissionAmount: number; // our platform commission for this payment (in dollars, exact from Adyen)
}

// platformPaymentType values that represent the net settlement to the org's balance account.
// Adyen returns separate transfers for each split (Commission, AdyenFees, BalanceAccount, etc.)
// all sharing the same pspPaymentReference. We only want the settlement transfer.
const BALANCE_ACCOUNT_PAYMENT_TYPES = new Set(["BalanceAccount", "Remainder", undefined, null]);

export async function fetchPlatformPaymentTransfers(
  balanceAccountId: string,
  since: Date,
  until: Date
): Promise<AdyenPlatformPayment[]> {
  // Query scoped to the balance platform (not the org's balanceAccountId) so we
  // capture every split for each payment:
  //   - BalanceAccount/Remainder split → org's balance account (net amount)
  //   - Commission split → platform's balance account (our fee, exact)
  //   - AdyenFees/AcquiringFees split → Adyen fees (exact)
  // All splits for one payment share the same categoryData.pspPaymentReference,
  // which lets us join them and recover the gross without any back-calculation.
  // Adyen requires at least one scope parameter; balanceAccountId would exclude
  // the platform-account splits, so we use balancePlatform instead.
  const balancePlatform = process.env.ADYEN_BALANCE_PLATFORM;
  if (!balancePlatform) {
    throw new Error("ADYEN_BALANCE_PLATFORM env var is required for fetchPlatformPaymentTransfers");
  }

  type RawTransfer = any;
  const grouped = new Map<string, RawTransfer[]>();
  let cursor: string | undefined;

  do {
    const response = await getTransfersApi().TransfersApi.getAllTransfers(
      since,
      until,
      balancePlatform,
      undefined, // accountHolderId
      undefined, // balanceAccountId — intentionally unfiltered to capture all splits
      undefined, // paymentInstrumentId
      undefined, // reference
      "platformPayment",
      "asc",
      cursor,
      100
    );

    for (const transfer of response.data ?? []) {
      const cd = transfer.categoryData as any;
      const pspRef: string | undefined = cd?.pspPaymentReference;
      if (!pspRef) continue;
      // pspPaymentReference is shared between an original payment and its
      // modifications (capture / refund / chargeback); modificationPspReference
      // distinguishes them. Group by both so reverse splits don't get folded
      // into the original's bucket (which would drop the modification's
      // settlement and double-count commission via the reversed Commission
      // split).
      const modRef: string | undefined = cd?.modificationPspReference;
      const key = `${pspRef}::${modRef ?? ""}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(transfer);
    }

    const nextHref = response._links?.next?.href;
    cursor = nextHref ? (new URL(nextHref).searchParams.get("cursor") ?? undefined) : undefined;
  } while (cursor);

  const transfers: AdyenPlatformPayment[] = [];
  for (const group of grouped.values()) {
    // Settlement: org's BalanceAccount/Remainder split landing on this org's balance account.
    const settlement = group.find((t) => {
      const cd = t.categoryData as any;
      const ppt = cd?.platformPaymentType;
      const ba = (t.balanceAccount as any)?.id;
      return BALANCE_ACCOUNT_PAYMENT_TYPES.has(ppt) && ba === balanceAccountId;
    });
    if (!settlement) continue;

    const cd = settlement.categoryData as any;
    const pspRef: string = cd?.pspPaymentReference;

    // Commission split (our platform fee). Lands on the platform's balance account.
    const commissionSplits = group.filter(
      (t) => (t.categoryData as any)?.platformPaymentType === "Commission"
    );
    // Adyen fees: typically reported via transfer.fees[] on the settlement transfer,
    // but can also appear as separate AdyenFees/AcquiringFees split transfers.
    const adyenFeeSplits = group.filter((t) => {
      const ppt = (t.categoryData as any)?.platformPaymentType;
      return ppt === "AdyenFees" || ppt === "AcquiringFees";
    });

    const sumAbs = (xs: RawTransfer[]) =>
      xs.reduce((sum, t) => sum + Math.abs(Number(t.amount?.value ?? 0)), 0);

    const settlementValue = Number(settlement.amount?.value ?? 0);
    const netAmount = settlementValue / 100; // signed: negative for refunds
    const commissionAmount = sumAbs(commissionSplits) / 100;

    // Prefer the explicit AdyenFees split transfers; fall back to settlement.fees[].
    let adyenFeeAmount = sumAbs(adyenFeeSplits) / 100;
    if (adyenFeeAmount === 0) {
      const fees = (settlement.fees ?? []) as Array<{ amount?: { value?: number } }>;
      adyenFeeAmount = fees.reduce((sum, f) => sum + Math.abs(f.amount?.value ?? 0), 0) / 100;
    }

    transfers.push({
      pspReference: pspRef,
      ...(cd?.modificationPspReference
        ? { modificationPspReference: cd.modificationPspReference as string }
        : {}),
      amount: netAmount,
      currency: settlement.amount?.currency ?? "USD",
      settledAt: settlement.createdAt ? new Date(settlement.createdAt) : new Date(),
      adyenFeeAmount,
      commissionAmount,
      ...(cd?.paymentMethod ? { method: cd.paymentMethod as string } : {}),
      ...(settlement.description ? { description: settlement.description as string } : {}),
      ...(settlement.reference ? { merchantRef: settlement.reference as string } : {}),
    });
  }

  return transfers;
}

export async function fetchSweepTransactionRefs(
  balanceAccountId: string,
  since: Date,
  until: Date
): Promise<string[]> {
  const transfers = await fetchPlatformPaymentTransfers(balanceAccountId, since, until);
  const refs = new Set<string>();
  for (const t of transfers) {
    refs.add(t.pspReference);
    if (t.modificationPspReference) refs.add(t.modificationPspReference);
  }
  return [...refs];
}

// ---------------------------------------------------------------------------
// Transfer Instruments (bank account lookup)
// ---------------------------------------------------------------------------

/**
 * Retrieve a transfer instrument (bank account) from Adyen.
 * Returns the last 4 digits of the bank account number, or null on failure.
 */
export async function getTransferInstrumentLast4(
  transferInstrumentId: string
): Promise<string | null> {
  try {
    const response =
      await getLemApi().TransferInstrumentsApi.getTransferInstrument(transferInstrumentId);
    const identification = response?.bankAccount?.accountIdentification;
    const accountNumber = identification?.accountNumber || identification?.iban || "";
    if (accountNumber.length >= 4) {
      return accountNumber.slice(-4);
    }
    return null;
  } catch (error: any) {
    console.error("adyen-platform: getTransferInstrumentLast4 failed", {
      transferInstrumentId,
      status: error.statusCode,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refunds (Checkout Modifications API)
// ---------------------------------------------------------------------------

export async function refundPayment(
  pspReference: string,
  amount: { value: number; currency: string },
  merchantAccount?: string,
  reference?: string
): Promise<{ pspReference: string; status: string; [key: string]: any }> {
  try {
    const { CheckoutAPI } = require("@adyen/api-library");
    const checkoutApi = new CheckoutAPI(getManagementClient());

    const response = await checkoutApi.ModificationsApi.refundCapturedPayment(pspReference, {
      amount,
      merchantAccount: merchantAccount || process.env.ADYEN_MERCHANT_ACCOUNT!,
      reference: reference || `refund-${pspReference}-${Date.now()}`,
    });

    return response;
  } catch (error: any) {
    console.error("adyen-platform: refundPayment failed", {
      pspReference,
      amount,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Allowed Origins (CORS whitelist for Adyen client-side SDK)
// ---------------------------------------------------------------------------

import { getSubdomainUrl } from "@/lib/env-domains";

/**
 * Register a subdomain as an allowed origin for the current Adyen API credential.
 * Idempotent — skips if already registered. Catches errors so callers are never blocked.
 */
export async function registerAllowedOrigin(subdomain: string): Promise<void> {
  const origin = getSubdomainUrl(subdomain);
  try {
    const api = getManagementApi();
    const existing = await api.MyAPICredentialApi.getAllowedOrigins();
    const origins: any[] = existing.data ?? existing ?? [];
    if (origins.some((o: any) => o.domain === origin)) return;
    await api.MyAPICredentialApi.addAllowedOrigin({ domain: origin });
    console.log(`Adyen: registered allowed origin ${origin}`);
  } catch (err) {
    console.error(`Failed to register Adyen allowed origin for ${origin}:`, err);
  }
}

/**
 * Remove a subdomain's allowed origin from the current Adyen API credential.
 * Idempotent — no-ops if not found. Catches errors so callers are never blocked.
 */
export async function removeAllowedOrigin(subdomain: string): Promise<void> {
  const origin = getSubdomainUrl(subdomain);
  try {
    const api = getManagementApi();
    const existing = await api.MyAPICredentialApi.getAllowedOrigins();
    const origins: any[] = existing.data ?? existing ?? [];
    const match = origins.find((o: any) => o.domain === origin);
    if (!match) return;
    await api.MyAPICredentialApi.removeAllowedOrigin(match.id);
    console.log(`Adyen: removed allowed origin ${origin}`);
  } catch (err) {
    console.error(`Failed to remove Adyen allowed origin for ${origin}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Management API
// ---------------------------------------------------------------------------

export async function createStore(data: {
  merchantId: string;
  description: string;
  shopperStatement?: string;
  address: {
    country: string;
    line1: string;
    city: string;
    stateOrProvince: string;
    postalCode: string;
  };
  phoneNumber: string;
  reference: string;
  splitConfiguration?: { splitConfigurationId: string; balanceAccountId: string };
  businessLineIds?: string[];
}): Promise<{ id: string; reference: string; [key: string]: any }> {
  try {
    const { merchantId, ...storeData } = data;
    return await getManagementApi().AccountStoreLevelApi.createStoreByMerchantId(
      merchantId,
      storeData
    );
  } catch (error: any) {
    console.error("adyen-platform: createStore failed", {
      merchantId: data.merchantId,
      reference: data.reference,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function getStoreByReference(
  merchantId: string,
  reference: string
): Promise<{ id: string; reference: string; [key: string]: any } | null> {
  try {
    const response = await getManagementApi().AccountStoreLevelApi.listStoresByMerchantId(
      merchantId,
      undefined,
      undefined,
      reference
    );
    return response.data?.[0] ?? null;
  } catch (error: any) {
    console.error("adyen-platform: getStoreByReference failed", {
      merchantId,
      reference,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

// TODO: USC-276 — update commission rates when org's subscription plan changes
export async function createPlatformSplitConfiguration(data: {
  merchantId: string;
  description: string;
  transactionFeeBasisPoints: number;
  perTransactionFeeMinorUnits: number;
}): Promise<string> {
  try {
    const result =
      await getManagementApi().SplitConfigurationMerchantLevelApi.createSplitConfiguration(
        data.merchantId,
        {
          description: data.description,
          rules: [
            {
              currency: PLATFORM_CURRENCY,
              fundingSource: "ANY",
              paymentMethod: "ANY",
              shopperInteraction: "ANY",
              splitLogic: {
                commission: {
                  variablePercentage: data.transactionFeeBasisPoints,
                  fixedAmount: data.perTransactionFeeMinorUnits,
                },
                acquiringFees: "deductFromLiableAccount",
                adyenFees: "deductFromLiableAccount",
                chargeback: "deductFromOneBalanceAccount",
                chargebackCostAllocation: "deductFromOneBalanceAccount",
                refund: "deductFromOneBalanceAccount",
                remainder: "addToOneBalanceAccount",
              },
            },
          ],
        }
      );

    if (!result.splitConfigurationId) {
      throw new Error("Adyen did not return a splitConfigurationId");
    }
    return result.splitConfigurationId;
  } catch (error: any) {
    console.error("adyen-platform: createPlatformSplitConfiguration failed", {
      merchantId: data.merchantId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function deletePlatformSplitConfiguration(
  merchantId: string,
  splitConfigurationId: string
): Promise<void> {
  try {
    await getManagementApi().SplitConfigurationMerchantLevelApi.deleteSplitConfiguration(
      merchantId,
      splitConfigurationId
    );
  } catch (error: any) {
    console.warn("adyen-platform: deletePlatformSplitConfiguration failed", {
      merchantId,
      splitConfigurationId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

export async function attachSplitConfigurationToStore(
  merchantId: string,
  storeId: string,
  splitConfigurationId: string,
  balanceAccountId: string,
  businessLineIds?: string[]
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      splitConfiguration: { splitConfigurationId, balanceAccountId },
    };
    if (businessLineIds && businessLineIds.length > 0) {
      updateData.businessLineIds = businessLineIds;
    }
    await getManagementApi().AccountStoreLevelApi.updateStore(merchantId, storeId, updateData);
  } catch (error: any) {
    console.error("adyen-platform: attachSplitConfigurationToStore failed", {
      merchantId,
      storeId,
      splitConfigurationId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PCI Questionnaires (platform facilitates signing for connected accounts)
// ---------------------------------------------------------------------------

/**
 * Generates and signs the PCI SAQ for a connected org's legal entity. Signing authority
 * is resolved in this order:
 *   1. Individual associated with the org as `signatory` (KYB'd during hosted onboarding)
 *   2. Individual associated with the org as `pciSignatory`
 *   3. The org's own legal entity (fallback — Adyen may reject if it requires an individual)
 *
 * The org retains PCI responsibility; the platform only automates the API calls
 * (disclosed upfront in onboarding).
 *
 * Idempotent — skips if Adyen reports no signing required or returns no questionnaire templates.
 * Never throws: PCI signing failure is logged so finalization is not blocked.
 */
export async function signPciForLegalEntity(
  legalEntityId: string
): Promise<{ signed: boolean; skipped: boolean }> {
  try {
    const statusResponse = await getLemApi().PCIQuestionnairesApi.calculatePciStatusOfLegalEntity(
      legalEntityId,
      {}
    );
    if (!statusResponse.signingRequired) {
      return { signed: false, skipped: true };
    }

    const generateResponse = await getLemApi().PCIQuestionnairesApi.generatePciQuestionnaire(
      legalEntityId,
      { language: "en" }
    );
    const templateRefs: string[] = generateResponse.pciTemplateReferences ?? [];
    if (templateRefs.length === 0) {
      return { signed: false, skipped: true };
    }

    const { signedBy, source } = await resolvePciSignedBy(legalEntityId);

    await getLemApi().PCIQuestionnairesApi.signPciQuestionnaire(legalEntityId, {
      pciTemplateReferences: templateRefs,
      signedBy,
    });

    console.log("adyen-platform: signPciForLegalEntity signed PCI questionnaire", {
      legalEntityId,
      signedBy,
      source,
      templateCount: templateRefs.length,
    });
    return { signed: true, skipped: false };
  } catch (error: any) {
    console.error("adyen-platform: signPciForLegalEntity failed", {
      legalEntityId,
      status: error.statusCode,
      body: error.responseBody,
    });
    return { signed: false, skipped: false };
  }
}

async function resolvePciSignedBy(
  legalEntityId: string
): Promise<{ signedBy: string; source: "signatory" | "pciSignatory" | "selfFallback" }> {
  try {
    const entity = await getLegalEntity(legalEntityId);
    const associations: Array<{ legalEntityId?: string; type?: string }> =
      entity.entityAssociations ?? [];
    const signatory = associations.find((a) => a.type === "signatory" && a.legalEntityId);
    if (signatory?.legalEntityId) {
      return { signedBy: signatory.legalEntityId, source: "signatory" };
    }
    const pciSignatory = associations.find((a) => a.type === "pciSignatory" && a.legalEntityId);
    if (pciSignatory?.legalEntityId) {
      return { signedBy: pciSignatory.legalEntityId, source: "pciSignatory" };
    }
  } catch (error: any) {
    console.warn("adyen-platform: resolvePciSignedBy entity lookup failed", {
      legalEntityId,
      status: error.statusCode,
    });
  }
  return { signedBy: legalEntityId, source: "selfFallback" };
}

/**
 * Configure payment methods on a store to create a MID (Merchant Identifier).
 * Adyen requires at least one payment method to be enabled at the store level before
 * the store can process checkout payments — without a MID, the checkout API returns 910 "Invalid Store".
 *
 * Requests `scheme` (all card brands) and `googlepay`; idempotent — silently skips already-configured methods.
 */
export async function addPaymentMethodsToStore(
  merchantId: string,
  storeId: string,
  businessLineId: string,
  storeDomain?: string
): Promise<void> {
  const types = ["mc", "visa", "amex", "discover", "ach", "googlepay", "applepay"] as const;
  const api = getManagementApi().PaymentMethodsMerchantLevelApi;

  // googlepay: use a configured merchant ID if available, otherwise ask Adyen to reuse
  // the platform-level Google Pay merchant ID. Both paths may require manual setup in
  // the Adyen Customer Area before the method becomes active.
  const googlePayMerchantId = process.env.ADYEN_GOOGLE_PAY_MERCHANT_ID;

  const typeExtras: Partial<Record<(typeof types)[number], Record<string, any>>> = {
    googlepay: {
      googlePay: googlePayMerchantId
        ? { merchantId: googlePayMerchantId }
        : { reuseMerchantId: true },
    },
    ...(storeDomain && {
      applepay: { applePay: { domains: [storeDomain] } },
    }),
  };

  const typesToRun = types;

  let added = 0;
  let alreadyExists = 0;

  for (const type of typesToRun) {
    try {
      const result = await api.requestPaymentMethod(merchantId, {
        type: type as any,
        storeIds: [storeId],
        businessLineId,
        currencies: ["USD"],
        countries: ["US"],
        ...(typeExtras[type] ?? {}),
      } as any);
      added++;
      console.log("adyen-platform: addPaymentMethodsToStore configured", {
        merchantId,
        storeId,
        type,
        pmId: (result as any).id,
        verificationStatus: (result as any).verificationStatus,
        allowed: (result as any).allowed,
      });
    } catch (error: any) {
      const body: string = error.responseBody ?? "";
      // A payment method of this type already exists at the merchant level.
      // It may not be assigned to our store yet — find it (without businessLineId filter,
      // since the existing PM may have been created with a different business line) and
      // PATCH it to include our store.
      if (error.statusCode === 422 && body.toLowerCase().includes("already")) {
        try {
          // Two-pass search:
          // 1. Look for a PM already assigned to our store — if found, only
          //    currencies/countries need fixing (never touches other orgs' stores).
          // 2. If not on our store yet, find the PM to associate by preferring
          //    businessLineId match (avoids picking up another org's config).
          const collect = async (sid: string | undefined): Promise<any[]> => {
            const results: any[] = [];
            let p = 1;
            while (true) {
              const page = await api.getAllPaymentMethods(merchantId, sid, undefined, 100, p);
              results.push(...(page.data ?? []).filter((pm: any) => pm.type === type));
              if (!page.hasNext) break;
              p++;
            }
            return results;
          };

          const onStore = await collect(storeId);
          let match: any = onStore[0] ?? null;
          if (!match) {
            const all = await collect(undefined);
            match = all.find((pm) => pm.businessLineId === businessLineId) ?? all[0] ?? null;
          }
          if (match) {
            const currentStoreIds: string[] = match.storeIds ?? [];
            const currentCurrencies: string[] = match.currencies ?? [];
            const currentCountries: string[] = match.countries ?? [];

            const needsStore = !currentStoreIds.includes(storeId);
            const needsCurrencies =
              currentCurrencies.length !== 1 || currentCurrencies[0] !== "USD";
            const needsCountries = currentCountries.length !== 1 || currentCountries[0] !== "US";

            if (needsStore || needsCurrencies || needsCountries) {
              await api.updatePaymentMethod(merchantId, match.id, {
                ...(needsStore && { storeIds: [...currentStoreIds, storeId] }),
                ...(needsCurrencies && { currencies: ["USD"] }),
                ...(needsCountries && { countries: ["US"] }),
              } as any);
              if (needsStore) added++;
              else alreadyExists++;
              console.log("adyen-platform: addPaymentMethodsToStore reconciled existing PM", {
                merchantId,
                storeId,
                type,
                pmId: match.id,
                needsStore,
                needsCurrencies,
                needsCountries,
              });
            } else {
              alreadyExists++;
            }
          } else {
            alreadyExists++;
          }
        } catch (updateError: any) {
          console.warn("adyen-platform: addPaymentMethodsToStore could not update existing PM", {
            merchantId,
            storeId,
            type,
            error: updateError?.message,
          });
          alreadyExists++;
        }
        continue;
      }
      // Some card brands may not be enabled on this merchant account (e.g. Discover in TEST).
      // Log and skip rather than blocking the whole finalization.
      if (error.statusCode === 422) {
        // Surface credential/config issues clearly so they're not mistaken for unsupported types.
        const isGooglePayCredential =
          type === "googlepay" && body.toLowerCase().includes("merchant identification");
        const isApplePayDomain =
          type === "applepay" &&
          (body.toLowerCase().includes("merchantshopurl") ||
            body.toLowerCase().includes("domains"));
        if (isGooglePayCredential) {
          console.warn(
            "adyen-platform: addPaymentMethodsToStore — Google Pay requires ADYEN_GOOGLE_PAY_MERCHANT_ID " +
              "to be set to a valid Google Pay merchant ID registered in the Adyen Customer Area.",
            { merchantId, storeId }
          );
        } else if (isApplePayDomain) {
          console.warn(
            "adyen-platform: addPaymentMethodsToStore — Apple Pay requires a verified HTTPS domain. " +
              "Set a real domain via the storeDomain parameter (HTTPS environments only).",
            { merchantId, storeId }
          );
        } else {
          console.warn("adyen-platform: addPaymentMethodsToStore skipping unsupported type", {
            merchantId,
            storeId,
            type,
            body,
          });
        }
        continue;
      }
      console.error("adyen-platform: addPaymentMethodsToStore failed", {
        merchantId,
        storeId,
        type,
        status: error.statusCode,
        body,
      });
      throw error;
    }
  }

  // If no type was added and none were already present, something is wrong.
  if (added === 0 && alreadyExists === 0) {
    throw new Error(
      `addPaymentMethodsToStore: all payment method types were rejected as unsupported for store ${storeId}. ` +
        "Check that the merchant account has at least mc/visa enabled."
    );
  }

  console.log("adyen-platform: addPaymentMethodsToStore complete", {
    merchantId,
    storeId,
    added,
    alreadyExists,
  });
}
