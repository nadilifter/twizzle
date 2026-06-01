// Azure AD client_credentials grant for the Skate Canada CRM app.
// Mirrors the PHP CrmSoap::getOauthAccessToken() flow:
//
//   POST https://login.microsoftonline.com/{tenantId}/oauth2/token
//        grant_type=client_credentials
//        client_id={app_id}
//        client_secret={app_secret}
//        resource={crm_host}
//
//   Response: { access_token, token_type, expires_in, expires_on, not_before, ... }
//
// The token is cached in a module-level Map keyed by tenant. Expiry is taken
// from `expires_on` (epoch seconds) with a small safety margin so we don't
// hand out a token in its last second of life.

import { CrmAuthError, CrmProtocolError, type CrmConfigError } from "./errors";
import { type SkateCanadaConfig } from "./config";

interface CachedToken {
  token: string;
  /** Unix epoch seconds when this token actually expires (per Azure response). */
  expiresAt: number;
}

// Module-level cache, keyed by the tenant ID. Safe for the in-process case
// (single Node worker). For multi-instance deployments, swap to a shared
// cache later — every call site reads through getAccessToken() so a
// transparent upgrade is straightforward.
const tokenCache = new Map<string, CachedToken>();

/** Seconds of safety margin to subtract from the upstream expiry. */
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

/**
 * Returns a current access token for the SC CRM app, using a cached token
 * when one is still valid and otherwise minting a new one. Concurrent
 * callers will each issue their own token request the first time — that's
 * fine for our load, and Azure dedupes anyway. We don't bother with a
 * promise-coalescing layer.
 */
export async function getAccessToken(
  config: SkateCanadaConfig,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const cached = tokenCache.get(config.tenantId);
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt > now + EXPIRY_SAFETY_MARGIN_SECONDS) {
    return cached.token;
  }

  const url = `https://login.microsoftonline.com/${encodeURIComponent(
    config.tenantId
  )}/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.appId,
    client_secret: config.appSecret,
    resource: config.host,
  });

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (cause) {
    throw new CrmAuthError("Failed to reach Azure AD token endpoint", null, { cause });
  }

  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text);
  } catch (cause) {
    throw new CrmProtocolError(
      `Azure AD token endpoint returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
      { cause }
    );
  }

  if (!response.ok || typeof payload.access_token !== "string") {
    const errorCode = typeof payload.error === "string" ? payload.error : null;
    const errorDesc =
      typeof payload.error_description === "string"
        ? payload.error_description
        : `HTTP ${response.status}`;
    throw new CrmAuthError(errorCode ? `${errorCode}: ${errorDesc}` : errorDesc, errorCode);
  }

  // `expires_on` (epoch seconds) is the absolute expiry. Fall back to
  // (now + expires_in) if the upstream skipped it.
  const expiresOn =
    typeof payload.expires_on === "string"
      ? Number(payload.expires_on)
      : typeof payload.expires_on === "number"
        ? payload.expires_on
        : null;
  const expiresIn =
    typeof payload.expires_in === "string"
      ? Number(payload.expires_in)
      : typeof payload.expires_in === "number"
        ? payload.expires_in
        : null;
  const expiresAt =
    Number.isFinite(expiresOn) && expiresOn !== null
      ? expiresOn
      : Number.isFinite(expiresIn) && expiresIn !== null
        ? now + expiresIn
        : now + 3600; // last-ditch fallback: 1 hour

  tokenCache.set(config.tenantId, {
    token: payload.access_token,
    expiresAt,
  });

  return payload.access_token;
}

/**
 * Drop any cached tokens. Tests and rotation events use this.
 */
export function clearTokenCache(): void {
  tokenCache.clear();
}

// Re-export so callers don't have to import errors separately just to catch.
export type { CrmConfigError };
