import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  isAllowedOrigin,
  getCurrentEnvironment,
  getEnvConfig,
  getSessionCookieName,
} from "@/lib/env-domains";

const nextAuthHandler = NextAuth(authOptions);

/**
 * Debug logging helper for auth troubleshooting
 * Only logs when AUTH_DEBUG=true or in staging/development cloud environments
 */
function logAuthDebug(phase: string, details: Record<string, unknown>) {
  const env = getCurrentEnvironment();
  const config = getEnvConfig();

  // Only log if AUTH_DEBUG is explicitly enabled, or in staging/development cloud environments
  // Skip verbose logging in local dev to reduce noise
  const shouldLog = process.env.AUTH_DEBUG === "true" || env === "staging" || env === "development";

  if (shouldLog) {
    console.log(
      `[Auth Debug][${env}][${phase}]`,
      JSON.stringify(
        {
          ...details,
          env,
          cookieDomain: config.cookieDomain,
          sessionCookieName: getSessionCookieName(),
        },
        null,
        2
      )
    );
  }
}

/**
 * Add CORS headers to response for cross-origin requests
 * This is critical for local development where login.twizzle.localhost:3000
 * needs to fetch CSRF tokens from localhost:3000 for Google OAuth
 */
function addCorsHeaders(request: NextRequest, response: Response): Response {
  const origin = request.headers.get("origin");

  if (origin && isAllowedOrigin(origin)) {
    // Clone the response to add headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", origin);
    newHeaders.set("Access-Control-Allow-Credentials", "true");
    newHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    newHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Explicitly copy Set-Cookie to avoid it being dropped during cloning
    // Note: Headers.get() might merge multiple Set-Cookie headers, but for Auth
    // we usually care about the session cookie.
    const setCookie = response.headers.get("Set-Cookie");
    if (setCookie) {
      // If newHeaders lost it (some environments), put it back
      if (!newHeaders.has("Set-Cookie")) {
        newHeaders.set("Set-Cookie", setCookie);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  return response;
}

/**
 * Handle CORS preflight requests
 */
function handlePreflight(request: NextRequest): NextResponse | null {
  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");

    if (origin && isAllowedOrigin(origin)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }

  return null;
}

/**
 * GET handler - Used for CSRF token, session, etc.
 * These don't need strict rate limiting as they're not login attempts.
 *
 * CORS headers are explicitly added here because middleware's NextResponse.next()
 * headers don't reliably propagate through to the NextAuth response.
 */
export async function GET(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const action = context.params.nextauth?.[0];

  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  // Log GET requests for session/csrf which are critical for auth flow
  if (action === "session" || action === "csrf") {
    logAuthDebug(`Request-GET`, {
      action,
      host: request.headers.get("host"),
      origin: request.headers.get("origin"),
      cookies: request.cookies.getAll().map((c) => c.name),
    });
  }

  const response = await nextAuthHandler(request, context);

  // Log session/csrf responses for debugging
  if (action === "session" || action === "csrf") {
    logResponse(`GET-${action}`, response, request);
  }

  return addCorsHeaders(request, response);
}

/**
 * OPTIONS handler - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  // If origin not allowed, return 204 without CORS headers
  return new NextResponse(null, { status: 204 });
}

/**
 * POST handler - Used for credential login, signout, etc.
 * Apply rate limiting to prevent brute force attacks.
 */
// ... imports

// Helper to parse and log cookie details for debugging
function parseCookieDetails(setCookieHeader: string | null): Record<string, unknown>[] {
  if (!setCookieHeader) return [];

  // Split by comma but be careful about commas in expires dates
  const cookies = setCookieHeader.split(/,(?=[^;]*=)/);

  return cookies.map((cookie) => {
    const parts = cookie
      .trim()
      .split(";")
      .map((p) => p.trim());
    const [nameValue, ...attributes] = parts;
    const [name] = nameValue.split("=");

    const attrs: Record<string, string | boolean> = {};
    for (const attr of attributes) {
      const [key, value] = attr.split("=");
      attrs[key.toLowerCase()] = value || true;
    }

    return {
      name: name.trim(),
      hasValue: nameValue.includes("=") && nameValue.split("=")[1]?.length > 0,
      domain: attrs["domain"] || "(not set - uses exact host)",
      secure: !!attrs["secure"],
      httpOnly: !!attrs["httponly"],
      sameSite: attrs["samesite"] || "(not set)",
      path: attrs["path"] || "/",
      maxAge: attrs["max-age"] || "(session)",
    };
  });
}

// Helper to log response details
function logResponse(action: string, response: Response, request?: NextRequest) {
  const setCookie = response.headers.get("Set-Cookie");
  const allowOrigin = response.headers.get("Access-Control-Allow-Origin");
  const cookieDetails = parseCookieDetails(setCookie);

  logAuthDebug(`Response-${action}`, {
    status: response.status,
    corsOrigin: allowOrigin,
    cookiesSet: cookieDetails.length,
    cookies: cookieDetails,
    requestHost: request?.headers.get("host"),
    requestOrigin: request?.headers.get("origin"),
  });
}

export async function POST(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const action = context.params.nextauth?.[0];
  const subAction = context.params.nextauth?.[1]; // e.g., "credentials" for callback/credentials

  // Log incoming request details
  logAuthDebug(`Request-POST`, {
    action,
    subAction,
    host: request.headers.get("host"),
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent")?.substring(0, 50),
    cookies: request.cookies.getAll().map((c) => c.name),
  });

  // Handle _log action to prevent 404s from NextAuth client logger
  if (action === "_log") {
    return new NextResponse(null, { status: 200 });
  }

  // Apply strict rate limiting for credential sign-in attempts
  if (action === "callback" || action === "signin") {
    const rateLimitResponse = await checkAuthRateLimit(request, RATE_LIMITS.auth);
    if (rateLimitResponse) {
      logAuthDebug(`RateLimited`, { action, subAction });
      return addCorsHeaders(request, rateLimitResponse);
    }
  }

  const response = await nextAuthHandler(request, context);

  // Debug: Log headers from NextAuth response before processing
  const rawSetCookie = response.headers.get("Set-Cookie");
  logAuthDebug(`NextAuthResponse`, {
    action,
    subAction,
    status: response.status,
    hasCookies: !!rawSetCookie,
    cookieLength: rawSetCookie?.length || 0,
    rawCookiePreview: rawSetCookie?.substring(0, 200),
  });

  const finalResponse = addCorsHeaders(request, response);
  logResponse(`POST-${action}`, finalResponse, request);
  return finalResponse;
}
