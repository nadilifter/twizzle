import { XeroClient, type TokenSetParameters } from "xero-node";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/accounting-encryption";

function getConfig() {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI are required");
  }

  return { clientId, clientSecret, redirectUri };
}

export function isXeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_REDIRECT_URI &&
    process.env.ACCOUNTING_ENCRYPTION_KEY
  );
}

let cachedOpenIdClient: any = null;
let cachedOpenIdClientExpiry = 0;
const OPENID_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createXeroClient(tokenSet?: TokenSetParameters): Promise<XeroClient> {
  const config = getConfig();
  const xero = new XeroClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUris: [config.redirectUri],
    scopes: [
      "openid",
      "profile",
      "email",
      "accounting.transactions",
      "accounting.contacts",
      "accounting.settings",
      "offline_access",
    ],
  });

  if (cachedOpenIdClient && Date.now() < cachedOpenIdClientExpiry) {
    xero.openIdClient = cachedOpenIdClient;
  } else {
    await xero.initialize();
    cachedOpenIdClient = xero.openIdClient;
    cachedOpenIdClientExpiry = Date.now() + OPENID_CACHE_TTL_MS;
  }

  if (tokenSet) {
    xero.setTokenSet(tokenSet);
  }

  return xero;
}

export async function generateXeroConsentUrl(state: string): Promise<string> {
  const xero = await createXeroClient();
  const url = await xero.buildConsentUrl();
  const urlObj = new URL(url);
  urlObj.searchParams.set("state", state);
  return urlObj.toString();
}

export async function handleXeroCallback(
  callbackUrl: string
): Promise<{ tokenSet: TokenSetParameters; tenantId: string; tenantName: string }> {
  const xero = await createXeroClient();
  const tokenSet = await xero.apiCallback(callbackUrl);
  const tenants = await xero.updateTenants(false);

  if (!tenants || tenants.length === 0) {
    throw new Error("No Xero tenants found. User must authorize at least one organization.");
  }

  const tenant = tenants[0];

  return {
    tokenSet: tokenSet as unknown as TokenSetParameters,
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName || "Unknown Organization",
  };
}

export function tokenSetToDbFields(tokenSet: TokenSetParameters, tenantId: string) {
  return {
    accessToken: encrypt(tokenSet.access_token!),
    refreshToken: encrypt(tokenSet.refresh_token!),
    tokenExpiresAt: new Date((tokenSet.expires_at || 0) * 1000),
    refreshExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Xero refresh tokens last 60 days
    tenantId,
  };
}

function dbToTokenSet(conn: {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}): TokenSetParameters {
  return {
    access_token: decrypt(conn.accessToken),
    refresh_token: decrypt(conn.refreshToken),
    expires_at: Math.floor(conn.tokenExpiresAt.getTime() / 1000),
    token_type: "Bearer",
  };
}

export async function revokeXeroTokens(connectionId: string): Promise<boolean> {
  const connection = await db.accountingConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return false;

  try {
    const tokenSet = dbToTokenSet(connection);
    const xero = await createXeroClient(tokenSet);
    await xero.revokeToken();
    return true;
  } catch {
    return false;
  }
}

export interface XeroApiClient {
  accountingApi: InstanceType<typeof XeroClient>["accountingApi"];
  tenantId: string;
}

export async function getXeroClient(connectionId: string): Promise<XeroApiClient> {
  const connection = await db.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || !connection.isActive) {
    throw new Error("Xero connection not found or inactive");
  }

  let tokenSet = dbToTokenSet(connection);

  const isExpired = (tokenSet.expires_at || 0) * 1000 <= Date.now();

  if (isExpired) {
    const xero = await createXeroClient(tokenSet);
    const newTokenSet = await xero.refreshToken();

    await db.accountingConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encrypt(newTokenSet.access_token!),
        refreshToken: encrypt(newTokenSet.refresh_token!),
        tokenExpiresAt: new Date((newTokenSet.expires_at || 0) * 1000),
      },
    });

    tokenSet = newTokenSet as unknown as TokenSetParameters;
  }

  const xero = await createXeroClient(tokenSet);

  return {
    accountingApi: xero.accountingApi,
    tenantId: connection.tenantId,
  };
}
