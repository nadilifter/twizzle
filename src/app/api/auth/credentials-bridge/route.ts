import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentEnvironment, getEnvConfig, getSessionCookieName } from "@/lib/env-domains";
import { logger } from "@/lib/logger";

/**
 * Credentials Bridge Endpoint
 *
 * LOCAL DEVELOPMENT ONLY:
 * This endpoint is called after credentials login completes on a local subdomain.
 * It reads the session (which was set on the exact hostname) and creates a bridge
 * token to transfer to the session-bridge, which sets the cookie with the correct
 * shared domain (.uplifter.localhost).
 *
 * This is needed because NextAuth sets cookies on the exact hostname by default
 * in local development, but we need cookies shared across all subdomains.
 *
 * PRODUCTION/STAGING:
 * In production/staging, cookies are set with domain=.upliftergymnastics.com
 * which is automatically shared across all subdomains. This bridge is not needed
 * and will simply redirect to the callback URL (passthrough mode).
 */

export async function GET(req: NextRequest) {
  // Rate limit to prevent abuse
  const rateLimitResponse = await checkAuthRateLimit(req, RATE_LIMITS.auth);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentEnv = getCurrentEnvironment();
  const config = getEnvConfig();
  const searchParams = req.nextUrl.searchParams;
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  // PRODUCTION/STAGING PASSTHROUGH:
  // In production/staging, cookies are already shared across subdomains via the
  // domain attribute (.upliftergymnastics.com). No bridge is needed - just redirect.
  if (currentEnv !== "local") {
    if (process.env.AUTH_DEBUG === "true") {
      logger.debug("Credentials bridge: production passthrough", { callbackUrl });
    }
    return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));
  }

  try {
    const allCookies = req.cookies.getAll();
    const sessionCookieName = getSessionCookieName();
    const sessionCookie = req.cookies.get(sessionCookieName);

    if (process.env.AUTH_DEBUG === "true") {
      logger.debug("Credentials bridge: cookies", { cookies: allCookies.map((c) => c.name) });
      logger.debug("Credentials bridge: session cookie check", {
        present: !!sessionCookie,
        cookieName: sessionCookieName,
      });
    }

    // Get the JWT token from the current session
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: sessionCookieName,
    });

    if (process.env.AUTH_DEBUG === "true") {
      logger.debug("Credentials bridge: token result", {
        found: !!token,
        email: token?.email ?? null,
      });
    }

    if (!token || !token.email) {
      console.error("Credentials bridge: No valid session found");
      console.error("Credentials bridge: Request origin:", req.nextUrl.origin);
      console.error("Credentials bridge: Request host:", req.headers.get("host"));
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("error", "SessionMissing");
      return NextResponse.redirect(loginUrl);
    }

    const email = token.email as string;
    const secret = process.env.NEXTAUTH_SECRET;

    if (!secret) {
      throw new Error("NEXTAUTH_SECRET not configured");
    }

    // Create bridge token
    const exp = Date.now() + 60 * 1000; // 60 seconds
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${email}:${exp}`)
      .digest("base64url");

    const tokenData = { email, exp, signature };
    const bridgeToken = Buffer.from(JSON.stringify(tokenData)).toString("base64url");

    // Redirect to session-bridge to set cookie with correct domain
    const protocol = config.useHttps ? "https" : "http";
    const bridgeUrl = new URL(`${protocol}://${config.baseDomain}/api/auth/session-bridge`);
    bridgeUrl.searchParams.set("token", bridgeToken);
    bridgeUrl.searchParams.set("callbackUrl", callbackUrl);

    if (process.env.AUTH_DEBUG === "true") {
      logger.info("Credentials bridge: redirecting to session bridge", { email });
    }
    return NextResponse.redirect(bridgeUrl);
  } catch (error) {
    console.error("Credentials bridge error:", error);
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "BridgeError");
    return NextResponse.redirect(loginUrl);
  }
}
