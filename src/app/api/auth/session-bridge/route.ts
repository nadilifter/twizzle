import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";

/**
 * Session Bridge Endpoint
 * 
 * This endpoint handles cross-domain authentication for Google OAuth.
 * Since Google OAuth only accepts localhost:3000 as an authorized origin,
 * but our app runs on *.uplifterinc.localhost subdomains, we need to:
 * 
 * 1. Complete OAuth on localhost:3000
 * 2. Pass a signed bridge token to this endpoint on uplifterinc.localhost
 * 3. This endpoint verifies the token and sets the session cookie for .uplifterinc.localhost
 * 
 * The bridge token contains the user's email (signed with NEXTAUTH_SECRET)
 * and is only valid for a short time (60 seconds).
 */

const BRIDGE_TOKEN_MAX_AGE = 60; // 60 seconds

export async function GET(req: NextRequest) {
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
        organization: true,
        permissions: true,
        memberships: {
          include: {
            organization: true,
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

    // Determine organization
    let organizationId = user.organizationId;
    let organizationName = user.organization?.name;

    if (!organizationId && user.memberships.length === 1) {
      organizationId = user.memberships[0].organizationId;
      organizationName = user.memberships[0].organization.name;
    } else if (!organizationId && user.memberships.length > 1) {
      organizationId = "";
      organizationName = "";
    }

    // Create the JWT token payload (matching auth.ts jwt callback)
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.avatar,
      role: user.role,
      organizationId: organizationId || "",
      organizationName: organizationName || "",
      permissions: user.permissions.map((p) => p.permission),
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
    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain = isProduction ? ".uplifterinc.com" : ".uplifterinc.localhost";

    // Create response with redirect
    const response = NextResponse.redirect(new URL(callbackUrl, req.nextUrl.origin));

    // Set the session cookie with the correct domain
    response.cookies.set("next-auth.session-token", sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isProduction,
      domain: cookieDomain,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    console.log("Session bridge: Successfully created session for:", email);
    return response;
  } catch (error) {
    console.error("Session bridge error:", error);
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("error", "BridgeError");
    return NextResponse.redirect(loginUrl);
  }
}

/**
 * Helper function to create a bridge token
 * This is exported for use in the custom Google callback
 */
export function createBridgeToken(email: string, secret: string): string {
  const crypto = require("crypto");
  const exp = Date.now() + BRIDGE_TOKEN_MAX_AGE * 1000;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${email}:${exp}`)
    .digest("base64url");

  const tokenData = { email, exp, signature };
  return Buffer.from(JSON.stringify(tokenData)).toString("base64url");
}
