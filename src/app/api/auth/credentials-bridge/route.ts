import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import crypto from "crypto";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentEnvironment, getEnvConfig, getSessionCookieName } from "@/lib/env-domains";

/**
 * Credentials Bridge Endpoint
 * 
 * LOCAL DEVELOPMENT ONLY:
 * This endpoint is called after credentials login completes on a local subdomain.
 * It reads the session (which was set on the exact hostname) and creates a bridge
 * token to transfer to the session-bridge, which sets the cookie with the correct
 * shared domain (.uplifterinc.localhost).
 * 
 * This is needed because NextAuth sets cookies on the exact hostname by default
 * in local development, but we need cookies shared across all subdomains.
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

  // Only needed in local development
  if (currentEnv !== 'local') {
    // In production, just redirect directly - cookies are already shared
    return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));
  }

  try {
    // Debug: Log all cookies to diagnose session issues
    const allCookies = req.cookies.getAll();
    console.log("Credentials bridge: All cookies:", allCookies.map(c => c.name));
    
    const sessionCookieName = getSessionCookieName();
    const sessionCookie = req.cookies.get(sessionCookieName);
    console.log("Credentials bridge: Session cookie present:", !!sessionCookie, "name:", sessionCookieName);
    
    // Get the JWT token from the current session
    const token = await getToken({ 
      req, 
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: sessionCookieName,
    });

    console.log("Credentials bridge: Token result:", token ? `Found (email: ${token.email})` : "Not found");

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
    const protocol = config.useHttps ? 'https' : 'http';
    const bridgeUrl = new URL(`${protocol}://${config.baseDomain}/api/auth/session-bridge`);
    bridgeUrl.searchParams.set("token", bridgeToken);
    bridgeUrl.searchParams.set("callbackUrl", callbackUrl);

    console.log("Credentials bridge: Redirecting to session bridge for:", email);
    return NextResponse.redirect(bridgeUrl);
  } catch (error) {
    console.error("Credentials bridge error:", error);
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "BridgeError");
    return NextResponse.redirect(loginUrl);
  }
}
