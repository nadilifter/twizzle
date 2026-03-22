import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getSubdomainUrl, getBaseUrl, getSessionCookieName, getCurrentEnvironment } from "@/lib/env-domains";
import { logger } from "@/lib/logger";

/**
 * OAuth Bridge Endpoint
 * 
 * LOCAL DEVELOPMENT ONLY:
 * This endpoint is called after Google OAuth completes on localhost:3000.
 * It creates a bridge token from the session and redirects to the session-bridge
 * endpoint on uplifterinc.localhost to set the cookie with the correct domain.
 * 
 * PRODUCTION/STAGING:
 * This bridge is NOT needed in production/staging because cookies are properly
 * configured with shared domain (.upliftergymnastics.com, .uplifterinc.com).
 * If someone lands here in production, we just redirect to the callback URL.
 */

function getEnvironmentUrls() {
  return {
    loginBaseUrl: getSubdomainUrl('login'),
    bridgeBaseUrl: getBaseUrl(),
    defaultCallback: `${getSubdomainUrl('admin')}/`,
  };
}

export async function GET(req: NextRequest) {
  // Rate limit to prevent abuse
  const rateLimitResponse = await checkAuthRateLimit(req, RATE_LIMITS.auth);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentEnv = getCurrentEnvironment();
  const { loginBaseUrl, bridgeBaseUrl, defaultCallback } = getEnvironmentUrls();
  const searchParams = req.nextUrl.searchParams;
  const callbackUrl = searchParams.get("callbackUrl") || defaultCallback;

  // PRODUCTION/STAGING PASSTHROUGH:
  // In production/staging, OAuth cookies are properly shared across subdomains,
  // so this bridge is not needed. Just redirect to the callback URL.
  // The session cookie is already set correctly by NextAuth.
  if (currentEnv !== 'local') {
    logger.debug("OAuth bridge: production passthrough", { env: currentEnv, callbackUrl });
    return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));
  }

  // LOCAL DEVELOPMENT: Bridge is needed because cookies can't be shared
  // across localhost:3000 and *.uplifterinc.localhost:3000
  try {
    // Get the JWT token from the session that was just created
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      // Try to get token even with potentially mismatched cookie domain
      cookieName: getSessionCookieName(),
    });

    if (!token || !token.email) {
      console.error("OAuth bridge: No valid session found");
      // Redirect back to login with error
      const loginUrl = new URL("/login", loginBaseUrl);
      loginUrl.searchParams.set("error", "OAuthSessionMissing");
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
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
    const bridgeUrl = new URL("/api/auth/session-bridge", bridgeBaseUrl);
    bridgeUrl.searchParams.set("token", bridgeToken);
    bridgeUrl.searchParams.set("callbackUrl", callbackUrl);

    logger.info("OAuth bridge: redirecting to session bridge", { email });
    return NextResponse.redirect(bridgeUrl);
  } catch (error) {
    console.error("OAuth bridge error:", error);
    const loginUrl = new URL("/login", loginBaseUrl);
    loginUrl.searchParams.set("error", "OAuthBridgeError");
    return NextResponse.redirect(loginUrl);
  }
}
