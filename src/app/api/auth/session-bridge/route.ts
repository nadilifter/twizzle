import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCurrentEnvironment, getEnvConfig, getSessionCookieName } from "@/lib/env-domains";

/**
 * Session Bridge Endpoint
 * 
 * LOCAL DEVELOPMENT ONLY:
 * This endpoint handles cross-domain authentication for Google OAuth and credentials login.
 * Since Google OAuth only accepts localhost:3000 as an authorized origin,
 * but our app runs on *.uplifterinc.localhost subdomains, we need to:
 * 
 * 1. Complete OAuth/credentials login on localhost:3000
 * 2. Pass a signed bridge token to this endpoint on uplifterinc.localhost
 * 3. This endpoint verifies the token and sets the session cookie for .uplifterinc.localhost
 * 
 * The bridge token contains the user's email (signed with NEXTAUTH_SECRET)
 * and is only valid for a short time (60 seconds).
 * 
 * PRODUCTION/STAGING:
 * In production/staging, cookies are set with domain=.upliftergymnastics.com
 * which is automatically shared across all subdomains. This bridge is not needed.
 * If no token is provided and we're not in local development, redirect to callback.
 */

const BRIDGE_TOKEN_MAX_AGE = 60; // 60 seconds

export async function GET(req: NextRequest) {
  // Rate limit session bridge requests to prevent abuse
  const rateLimitResponse = await checkAuthRateLimit(req, RATE_LIMITS.auth);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const currentEnv = getCurrentEnvironment();
  const searchParams = req.nextUrl.searchParams;
  const bridgeToken = searchParams.get("token");
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  // Handle OAuth errors passed through the bridge
  if (error) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", error);
    return NextResponse.redirect(loginUrl);
  }

  // PRODUCTION/STAGING PASSTHROUGH:
  // In production/staging, if there's no bridge token, just redirect to callback.
  // This can happen if someone bookmarks a bridge URL or there's a redirect loop.
  // The session cookie is already set with the correct domain, so no action needed.
  if (!bridgeToken && currentEnv !== 'local') {
    console.log(`Session bridge: Production passthrough (no token), redirecting to ${callbackUrl}`);
    return NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));
  }

  if (!bridgeToken) {
    console.error("Session bridge: No token provided");
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "BridgeTokenMissing");
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Decode and verify the bridge token
    const tokenData = JSON.parse(
      Buffer.from(bridgeToken, "base64url").toString("utf-8")
    );

    const { email, exp, signature } = tokenData;

    // Check expiration
    if (Date.now() > exp) {
      console.error("Session bridge: Token expired");
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("error", "BridgeTokenExpired");
      return NextResponse.redirect(loginUrl);
    }

    // Verify signature
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET not configured");
    }

    const crypto = await import("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${email}:${exp}`)
      .digest("base64url");

    if (signature !== expectedSignature) {
      console.error("Session bridge: Invalid signature");
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("error", "BridgeTokenInvalid");
      return NextResponse.redirect(loginUrl);
    }

    // Fetch user from database
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            organization: true,
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      console.error("Session bridge: User not found:", email);
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("error", "NoAccount");
      return NextResponse.redirect(loginUrl);
    }

    // Determine organization from memberships
    let organizationId = "";
    let organizationName = "";
    let membership: (typeof user.memberships)[number] | undefined;

    if (user.memberships.length === 1) {
      membership = user.memberships[0];
      organizationId = membership.organizationId;
      organizationName = membership.organization.name;
    }

    // Resolve permissions from org membership (matching auth.ts logic)
    let permissions: string[];
    if (user.isSuperAdmin) {
      permissions = ["*"];
    } else if (membership) {
      const memberPerms = membership.permissions.map((p) => p.permission);
      permissions = memberPerms.length > 0 ? memberPerms : [];
    } else {
      permissions = [];
    }

    // Create the JWT token payload (matching auth.ts jwt callback)
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatar,
      role: membership?.role || user.role,
      organizationId,
      organizationName,
      permissions,
      isSuperAdmin: user.isSuperAdmin,
      sub: user.id,
    };

    // Encode the session token
    const sessionToken = await encode({
      token: tokenPayload,
      secret,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Determine cookie domain based on environment
    // Use the same environment detection as the logout route for consistency
    const currentEnv = getCurrentEnvironment();
    const config = getEnvConfig();
    
    let cookieDomain: string;
    if (currentEnv === 'local') {
      // In local dev, use the shared local domain
      cookieDomain = ".uplifterinc.localhost";
    } else {
      // In cloud environments, use the configured cookie domain
      cookieDomain = config.cookieDomain;
    }
    
    const isSecure = currentEnv !== 'local';

    // Create response with redirect
    const response = NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));

    // Set the session cookie with the correct domain
    const cookieName = getSessionCookieName();
    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isSecure,
      domain: cookieDomain,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    
    console.log(`Session bridge: Setting cookie on domain ${cookieDomain}, secure: ${isSecure}`);

    console.log("Session bridge: Successfully created session for:", email);
    return response;
  } catch (error) {
    console.error("Session bridge error:", error);
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "BridgeError");
    return NextResponse.redirect(loginUrl);
  }
}

// Note: createBridgeToken has been moved to @/lib/bridge-token.ts
// Import it from there for use in other files
