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
  splitConfiguration?: {
    balanceAccountId: string;
    splitConfigurationId: string;
  };
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
