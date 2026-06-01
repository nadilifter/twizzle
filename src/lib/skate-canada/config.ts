// Skate Canada CRM connection config — read from environment, validated
// at load time. Keep all secret handling in this file so nothing else has
// to know the env-var names.
//
// Env vars (test / sandbox):
//   SKATE_CANADA_CRM_TENANT_ID    — Azure AD tenant GUID for SC's CRM
//   SKATE_CANADA_CRM_APP_ID       — App registration (client) ID
//   SKATE_CANADA_CRM_APP_SECRET   — App registration client secret (rotates;
//                                   when missing or expired, calls 401)
//   SKATE_CANADA_CRM_HOST         — CRM org URL, e.g.
//                                   https://skatecanadatest.api.crm3.dynamics.com
//
// Until live credentials are loaded, callers should check `getConfig()` —
// it throws CrmConfigError with a clear message naming the missing variable.

import { CrmConfigError } from "./errors";

export interface SkateCanadaConfig {
  tenantId: string;
  appId: string;
  appSecret: string;
  /** Full https URL to the CRM org, NO trailing slash. */
  host: string;
}

function readEnv(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

/**
 * Returns the Skate Canada CRM config from environment, or throws
 * CrmConfigError if any required var is missing. The error message names
 * the missing var so the operator can fix it without guessing.
 */
export function getConfig(): SkateCanadaConfig {
  const tenantId = readEnv("SKATE_CANADA_CRM_TENANT_ID");
  const appId = readEnv("SKATE_CANADA_CRM_APP_ID");
  const appSecret = readEnv("SKATE_CANADA_CRM_APP_SECRET");
  const host = readEnv("SKATE_CANADA_CRM_HOST");

  const missing: string[] = [];
  if (!tenantId) missing.push("SKATE_CANADA_CRM_TENANT_ID");
  if (!appId) missing.push("SKATE_CANADA_CRM_APP_ID");
  if (!appSecret) missing.push("SKATE_CANADA_CRM_APP_SECRET");
  if (!host) missing.push("SKATE_CANADA_CRM_HOST");

  if (missing.length) {
    throw new CrmConfigError(`Skate Canada CRM config missing: ${missing.join(", ")}`);
  }

  // Normalize host: strip trailing slash.
  const normalizedHost = host!.replace(/\/+$/, "");

  return {
    tenantId: tenantId!,
    appId: appId!,
    appSecret: appSecret!,
    host: normalizedHost,
  };
}

/**
 * True if all required env vars are present. Useful at app boot to decide
 * whether the SC live-lookup endpoints should even be registered.
 */
export function isConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}
