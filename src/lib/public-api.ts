import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEnvConfig, getCurrentEnvironment } from "@/lib/env-domains";
import { checkApiRateLimit } from "@/lib/rate-limit";

const SYSTEM_SUBDOMAINS = new Set([
  "admin",
  "login",
  "superadmin",
  "coach",
  "athletes",
  "pos",
  "feedback",
  "events",
  "startup",
  "www",
  "main",
]);

/**
 * Parse a tenant slug from the Host header. Returns null if the host
 * is a system subdomain (admin, login, etc.) or the bare base domain.
 */
function parseSlugFromHost(hostname: string): string | null {
  const config = getEnvConfig();
  const currentEnv = getCurrentEnvironment();
  const baseDomain = config.baseDomain.split(":")[0];
  const isLocal = currentEnv === "local";

  let subdomain: string | null = null;

  if (isLocal) {
    const localRoot = config.baseDomain;
    if (
      hostname === "localhost:3000" ||
      hostname === localRoot ||
      hostname === `www.${localRoot}`
    ) {
      return null;
    } else if (hostname.endsWith(localRoot)) {
      subdomain = hostname.replace(`.${localRoot}`, "");
    } else if (hostname.endsWith(".localhost:3000")) {
      subdomain = hostname.replace(".localhost:3000", "");
    }
  } else {
    if (hostname === baseDomain || hostname === `www.${baseDomain}`) {
      return null;
    }
    if (hostname.endsWith(`.${baseDomain}`)) {
      subdomain = hostname.replace(`.${baseDomain}`, "");
    }
  }

  if (!subdomain || SYSTEM_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  return subdomain;
}

type ResolveResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string; status: number };

/**
 * Securely resolve the organizationId for a public API route.
 *
 * 1. If the request originates from a tenant subdomain (e.g. demo-gym.uplifterinc.com),
 *    the org is resolved from the Host header via WebsiteConfig. Any client-provided
 *    organizationId is validated against it.
 * 2. Otherwise, if an organizationId is provided via query/body, it is validated by
 *    confirming the org has an active WebsiteConfig (i.e. a public storefront).
 *
 * This prevents unauthenticated enumeration of arbitrary organizations.
 */
export async function resolvePublicOrganizationId(
  request: NextRequest,
  paramOrganizationId?: string | null
): Promise<ResolveResult> {
  const hostname = request.headers.get("host") || "";
  const slug = parseSlugFromHost(hostname);

  if (slug) {
    const config = await db.websiteConfig.findUnique({
      where: { subdomain: slug },
      select: { organizationId: true },
    });

    if (!config) {
      return { ok: false, error: "Site not found", status: 404 };
    }

    if (paramOrganizationId && paramOrganizationId !== config.organizationId) {
      return { ok: false, error: "Access denied", status: 403 };
    }

    return { ok: true, organizationId: config.organizationId };
  }

  if (!paramOrganizationId) {
    return { ok: false, error: "organizationId is required", status: 400 };
  }

  const site = await db.websiteConfig.findFirst({
    where: { organizationId: paramOrganizationId },
    select: { organizationId: true },
  });

  if (!site) {
    return { ok: false, error: "Organization not found", status: 404 };
  }

  return { ok: true, organizationId: paramOrganizationId };
}

/**
 * Convenience wrapper: resolve the org AND apply rate limiting for public routes.
 * Returns a NextResponse error if rate-limited or org resolution fails, or the
 * organizationId on success.
 */
export async function resolvePublicRequest(
  request: NextRequest,
  paramOrganizationId?: string | null
): Promise<{ organizationId: string } | NextResponse> {
  const rateLimited = await checkApiRateLimit(request, "public");
  if (rateLimited) return rateLimited as NextResponse;

  const result = await resolvePublicOrganizationId(request, paramOrganizationId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return { organizationId: result.organizationId };
}
