import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentEnvironment, getEnvConfig, getSessionCookieName } from "@/lib/env-domains";

/**
 * Custom Logout Endpoint
 * 
 * This endpoint properly clears the session cookie across all subdomains.
 * 
 * The issue: NextAuth's default signOut doesn't always clear cookies correctly
 * when using cross-subdomain sessions. In local development, the cookie is set
 * on `.uplifterinc.localhost` by session-bridge, but NextAuth's signOut tries
 * to clear a cookie with no domain (defaults to exact hostname).
 * 
 * This endpoint explicitly clears the cookie with the correct domain for the
 * current environment, ensuring the user is fully logged out.
 * 
 * IMPORTANT: We use raw Set-Cookie headers because NextResponse.cookies.set()
 * overwrites previous cookies with the same name. We need to set multiple
 * cookies with the same name but different domains to ensure all are cleared.
 */

/**
 * Build a Set-Cookie header string to clear a cookie
 */
function buildClearCookieHeader(
  name: string, 
  options: { 
    domain?: string; 
    path?: string; 
    secure?: boolean;
    sameSite?: string;
  }
): string {
  const parts = [
    `${name}=`,
    `Path=${options.path || "/"}`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `Max-Age=0`,
  ];
  
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  
  if (options.secure) {
    parts.push("Secure");
  }
  
  parts.push("HttpOnly");
  parts.push(`SameSite=${options.sameSite || "Lax"}`);
  
  return parts.join("; ");
}

/**
 * Get all Set-Cookie headers needed to clear auth cookies
 */
function getClearCookieHeaders(cookieDomain: string, isSecure: boolean): string[] {
  const headers: string[] = [];
  const sessionCookieName = getSessionCookieName();
  const cookieNames = [
    sessionCookieName,
    "next-auth.session-token",
    "next-auth.callback-url", 
    "next-auth.csrf-token",
    // Also try the __Secure- prefixed versions in case they exist
    "__Secure-next-auth.session-token",
  ];
  
  for (const name of cookieNames) {
    // Clear with the parent domain (e.g., .uplifterinc.localhost)
    headers.push(buildClearCookieHeader(name, {
      domain: cookieDomain,
      path: "/",
      secure: isSecure,
      sameSite: "Lax",
    }));
    
    // Also clear without domain (for cookies on exact hostname)
    headers.push(buildClearCookieHeader(name, {
      path: "/",
      secure: isSecure,
      sameSite: "Lax",
    }));
  }
  
  return headers;
}

/**
 * Log existing cookies for debugging
 */
function logExistingCookies() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  console.log("Logout: Existing cookies:", allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 20) + "..." })));
  
  const sessionCookieName = getSessionCookieName();
  const sessionCookie = cookieStore.get(sessionCookieName) || cookieStore.get("next-auth.session-token");
  if (sessionCookie) {
    console.log("Logout: Found session cookie, length:", sessionCookie.value.length);
  } else {
    console.log("Logout: No session cookie found in request");
  }
}

export async function POST(req: NextRequest) {
  const currentEnv = getCurrentEnvironment();
  const config = getEnvConfig();
  
  // Log existing cookies for debugging
  logExistingCookies();
  
  // Determine the correct cookie domain based on environment
  let cookieDomain: string;
  if (currentEnv === 'local') {
    // In local dev, session-bridge sets cookies on .uplifterinc.localhost
    cookieDomain = ".uplifterinc.localhost";
  } else {
    // In cloud environments, use the configured cookie domain
    cookieDomain = config.cookieDomain;
  }
  
  const isSecure = currentEnv !== 'local';
  
  console.log(`Logout POST: Environment=${currentEnv}, CookieDomain=${cookieDomain}, Secure=${isSecure}`);
  
  // Parse the request body to get the callback URL
  let callbackUrl = "/login";
  try {
    const body = await req.json();
    if (body.callbackUrl) {
      callbackUrl = body.callbackUrl;
    }
  } catch {
    // No body or invalid JSON - use default callback
  }
  
  // Build the full callback URL
  const protocol = config.useHttps ? 'https' : 'http';
  const loginHost = `login.${config.baseDomain}`;
  const fullCallbackUrl = callbackUrl.startsWith('http') 
    ? callbackUrl 
    : `${protocol}://${loginHost}${callbackUrl}`;
  
  // Create response with the redirect URL
  const response = new NextResponse(
    JSON.stringify({ 
      success: true, 
      redirectUrl: fullCallbackUrl 
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  
  // Add all Set-Cookie headers to clear cookies
  const clearCookieHeaders = getClearCookieHeaders(cookieDomain, isSecure);
  for (const header of clearCookieHeaders) {
    response.headers.append("Set-Cookie", header);
  }
  
  console.log(`Logout POST: Set ${clearCookieHeaders.length} Set-Cookie headers`);
  console.log(`Logout POST: Headers:`, clearCookieHeaders);
  
  return response;
}

/**
 * GET handler - redirect to login page
 * This allows the endpoint to work as a simple link/redirect as well
 */
export async function GET(req: NextRequest) {
  const currentEnv = getCurrentEnvironment();
  const config = getEnvConfig();
  
  // Log existing cookies for debugging
  logExistingCookies();
  
  // Determine the correct cookie domain based on environment
  let cookieDomain: string;
  if (currentEnv === 'local') {
    cookieDomain = ".uplifterinc.localhost";
  } else {
    cookieDomain = config.cookieDomain;
  }
  
  const isSecure = currentEnv !== 'local';
  
  console.log(`Logout GET: Environment=${currentEnv}, CookieDomain=${cookieDomain}, Secure=${isSecure}`);
  console.log(`Logout GET: Request host=${req.headers.get("host")}`);
  
  // Build the redirect URL: use ?redirectUrl query param if provided, otherwise default to login
  const protocol = config.useHttps ? 'https' : 'http';
  const redirectParam = req.nextUrl.searchParams.get("redirectUrl");
  let redirectUrl: string;
  if (redirectParam) {
    // Use the provided redirect URL (must be an absolute URL for safety)
    redirectUrl = redirectParam.startsWith("http") ? redirectParam : `${protocol}://login.${config.baseDomain}/login`;
  } else {
    const loginHost = `login.${config.baseDomain}`;
    redirectUrl = `${protocol}://${loginHost}/login`;
  }
  
  console.log(`Logout GET: Redirecting to ${redirectUrl}`);
  
  // Create redirect response
  const response = NextResponse.redirect(redirectUrl);
  
  // Add all Set-Cookie headers to clear cookies
  const clearCookieHeaders = getClearCookieHeaders(cookieDomain, isSecure);
  for (const header of clearCookieHeaders) {
    response.headers.append("Set-Cookie", header);
  }
  
  console.log(`Logout GET: Set ${clearCookieHeaders.length} Set-Cookie headers`);
  console.log(`Logout GET: Headers:`, clearCookieHeaders);
  
  return response;
}
