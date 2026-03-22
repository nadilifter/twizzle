/**
 * Adyen Platform API Client (Balance Platform / Marketplace)
 *
 * Wraps LEM, Configuration, and Management APIs using two separate credential scopes:
 *   - ADYEN_LEM_API_KEY: Legal Entity Management (legal entities, business lines, onboarding)
 *   - ADYEN_PLATFORM_API_KEY: Configuration + Management (account holders, balance accounts, stores)
 *
 * Follows the same lazy-initialization pattern as src/lib/adyen.ts.
 */

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
    throw new Error(
      "ADYEN_LEM_API_KEY is not set. Required for Legal Entity Management API."
    );
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
    throw new Error(
      "ADYEN_API_KEY is not set. Required for Management API (stores)."
    );
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

export async function createBalanceAccount(data: {
  accountHolderId: string;
  description?: string;
}): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().BalanceAccountsApi.createBalanceAccount({
      ...data,
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
    type: "push";
    schedule: { type: string };
    priorities: string[];
    currency: string;
  }
): Promise<{ id: string; [key: string]: any }> {
  try {
    return await getConfigApi().BalanceAccountsApi.createSweep(
      balanceAccountId,
      data
    );
  } catch (error: any) {
    console.error("adyen-platform: createSweep failed", {
      balanceAccountId,
      status: error.statusCode,
      body: error.responseBody,
    });
    throw error;
  }
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
    const response = await getLemApi().TransferInstrumentsApi.getTransferInstrument(
      transferInstrumentId
    );
    const accountNumber =
      response?.bankAccount?.accountNumber ||
      response?.bankAccount?.iban ||
      "";
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
  reference?: string,
): Promise<{ pspReference: string; status: string; [key: string]: any }> {
  try {
    const { CheckoutAPI } = require("@adyen/api-library");
    const checkoutApi = new CheckoutAPI(getManagementClient());

    const response = await checkoutApi.ModificationsApi.refundCapturedPayment(
      pspReference,
      {
        amount,
        merchantAccount: merchantAccount
          || process.env.ADYEN_MERCHANT_ACCOUNT!,
        reference: reference || `refund-${pspReference}-${Date.now()}`,
      }
    );

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
