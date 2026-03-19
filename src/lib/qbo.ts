import { AuthProvider, AuthScopes, Environment } from "quickbooks-api";
import type { Token } from "quickbooks-api";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/accounting-encryption";

const QBO_BASE_URLS = {
  sandbox: "https://sandbox-quickbooks.api.intuit.com/v3/company",
  production: "https://quickbooks.api.intuit.com/v3/company",
} as const;

function getConfig() {
  const clientId = process.env.QBO_CLIENT_ID;
  const clientSecret = process.env.QBO_CLIENT_SECRET;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const environment = process.env.QBO_ENVIRONMENT || "sandbox";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI are required");
  }

  return { clientId, clientSecret, redirectUri, environment };
}

export function isQboConfigured(): boolean {
  return !!(
    process.env.QBO_CLIENT_ID &&
    process.env.QBO_CLIENT_SECRET &&
    process.env.QBO_REDIRECT_URI &&
    process.env.ACCOUNTING_ENCRYPTION_KEY
  );
}

function getEnvironment(): Environment {
  return process.env.QBO_ENVIRONMENT === "production"
    ? Environment.Production
    : Environment.Sandbox;
}

function getBaseUrl(): string {
  const env = process.env.QBO_ENVIRONMENT === "production" ? "production" : "sandbox";
  return QBO_BASE_URLS[env];
}

export function createAuthProvider(token?: Token): AuthProvider {
  const config = getConfig();
  const provider = new AuthProvider(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
    [AuthScopes.Accounting],
    token,
    getEnvironment()
  );
  provider.enableAutoRefresh();
  return provider;
}

export function generateOAuthUrl(state: string): string {
  const provider = createAuthProvider();
  return provider.generateAuthUrl(state).toString();
}

export async function exchangeCodeForTokens(
  code: string,
  realmId: string
): Promise<Token> {
  const provider = createAuthProvider();
  return provider.exchangeCode(code, realmId);
}

export async function revokeTokens(connectionId: string): Promise<boolean> {
  const connection = await db.accountingConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return false;

  const token = connectionToToken(connection);
  const provider = createAuthProvider(token);

  try {
    return await provider.revoke();
  } catch {
    return false;
  }
}

interface AccountingConnectionRecord {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  refreshExpiresAt: Date;
  tenantId: string;
}

function connectionToToken(conn: AccountingConnectionRecord): Token {
  return {
    tokenType: "bearer" as any,
    accessToken: decrypt(conn.accessToken),
    refreshToken: decrypt(conn.refreshToken),
    accessTokenExpiryDate: conn.tokenExpiresAt,
    refreshTokenExpiryDate: conn.refreshExpiresAt,
    realmId: conn.tenantId,
  };
}

export function tokenToDbFields(token: Token) {
  return {
    accessToken: encrypt(token.accessToken),
    refreshToken: encrypt(token.refreshToken),
    tokenExpiresAt: token.accessTokenExpiryDate,
    refreshExpiresAt: token.refreshTokenExpiryDate,
    tenantId: token.realmId,
  };
}

async function refreshAndPersist(connectionId: string, token: Token): Promise<Token> {
  const provider = createAuthProvider(token);
  const newToken = await provider.refresh();

  await db.accountingConnection.update({
    where: { id: connectionId },
    data: tokenToDbFields(newToken),
  });

  return newToken;
}

function isTokenExpired(token: Token): boolean {
  return new Date() >= token.accessTokenExpiryDate;
}

export interface QboApiClient {
  get: <T = any>(endpoint: string) => Promise<T>;
  post: <T = any>(endpoint: string, body: any) => Promise<T>;
  query: <T = any>(queryStr: string) => Promise<T[]>;
}

export async function getQboClient(connectionId: string): Promise<QboApiClient> {
  const connection = await db.accountingConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection || !connection.isActive) {
    throw new Error("QBO connection not found or inactive");
  }

  let token = connectionToToken(connection);

  if (isTokenExpired(token)) {
    token = await refreshAndPersist(connectionId, token);
  }

  const baseUrl = `${getBaseUrl()}/${token.realmId}`;

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> || {}),
    };

    let response = await fetch(url, { ...init, headers });

    if (response.status === 401) {
      token = await refreshAndPersist(connectionId, token);
      headers.Authorization = `Bearer ${token.accessToken}`;
      response = await fetch(url, { ...init, headers });
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new QboApiError(
        `QBO API error ${response.status}: ${errorBody}`,
        response.status,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T = any>(endpoint: string) =>
      request<T>(`${baseUrl}/${endpoint}`, { method: "GET" }),

    post: <T = any>(endpoint: string, body: any) =>
      request<T>(`${baseUrl}/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),

    query: async <T = any>(queryStr: string) => {
      const encoded = encodeURIComponent(queryStr);
      const result = await request<any>(
        `${baseUrl}/query?query=${encoded}`,
        { method: "GET" }
      );
      return (result?.QueryResponse
        ? Object.values(result.QueryResponse).find(Array.isArray) as T[] || []
        : []) as T[];
    },
  };
}

export class QboApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = "QboApiError";
  }
}
