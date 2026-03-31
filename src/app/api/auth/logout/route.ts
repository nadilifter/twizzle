import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentEnvironment, getEnvConfig, getSessionCookieName } from "@/lib/env-domains";

/**
 * Custom Logout Endpoint
 *
 * Clears the session cookie on the shared parent domain (.uplifter.localhost
 * in local dev, .upliftergymnastics.com in staging) using
 * response.cookies.set() with maxAge: 0.
 */

function logExistingCookies() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  console.log(
    "Logout: Existing cookies:",
    allCookies.map((c) => ({ name: c.name, value: c.value.substring(0, 20) + "..." }))
  );

  const sessionCookieName = getSessionCookieName();
  const sessionCookie =
    cookieStore.get(sessionCookieName) || cookieStore.get("next-auth.session-token");
  if (sessionCookie) {
    console.log("Logout: Found session cookie, length:", sessionCookie.value.length);
  } else {
    console.log("Logout: No session cookie found in request");
  }
}

function clearAuthCookies(response: NextResponse, cookieDomain: string, isSecure: boolean) {
  const sessionCookieName = getSessionCookieName();

  const cookieNames = new Set([
    sessionCookieName,
    "next-auth.session-token",
    "next-auth.callback-url",
    "next-auth.csrf-token",
    "__Secure-next-auth.session-token",
  ]);

  for (const name of cookieNames) {
    response.cookies.set(name, "", {
      path: "/",
      secure: isSecure,
      sameSite: "lax",
      httpOnly: true,
      maxAge: 0,
      domain: cookieDomain,
    });
  }
}

export async function POST(req: NextRequest) {
  const currentEnv = getCurrentEnvironment();
  const config = getEnvConfig();

  logExistingCookies();

  const cookieDomain = currentEnv === "local" ? ".uplifter.localhost" : config.cookieDomain;
  const isSecure = currentEnv !== "local";

  let callbackUrl = "/login";
  try {
    const body = await req.json();
    if (body.callbackUrl) {
      callbackUrl = body.callbackUrl;
    }
  } catch {
    // No body or invalid JSON
  }

  const protocol = config.useHttps ? "https" : "http";
  const loginHost = `login.${config.baseDomain}`;
  const fullCallbackUrl = callbackUrl.startsWith("http")
    ? callbackUrl
    : `${protocol}://${loginHost}${callbackUrl}`;

  const response = NextResponse.json({ success: true, redirectUrl: fullCallbackUrl });
  clearAuthCookies(response, cookieDomain, isSecure);

  console.log("Logout POST: Cookies cleared, redirectUrl:", fullCallbackUrl);
  return response;
}

/**
 * GET handler — clear cookies then redirect to login page.
 */
export async function GET(req: NextRequest) {
  const currentEnv = getCurrentEnvironment();
  const config = getEnvConfig();

  logExistingCookies();

  const cookieDomain = currentEnv === "local" ? ".uplifter.localhost" : config.cookieDomain;
  const isSecure = currentEnv !== "local";

  const protocol = config.useHttps ? "https" : "http";
  const redirectParam = req.nextUrl.searchParams.get("redirectUrl");
  let redirectUrl: string;
  if (redirectParam) {
    redirectUrl = redirectParam.startsWith("http")
      ? redirectParam
      : `${protocol}://login.${config.baseDomain}/login`;
  } else {
    redirectUrl = `${protocol}://login.${config.baseDomain}/login`;
  }

  console.log(`Logout GET: Redirecting to ${redirectUrl}`);

  const response = NextResponse.redirect(redirectUrl);
  clearAuthCookies(response, cookieDomain, isSecure);

  console.log("Logout GET: Cookies cleared");
  return response;
}
