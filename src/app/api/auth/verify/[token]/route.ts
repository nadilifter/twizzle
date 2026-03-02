import { NextRequest, NextResponse } from "next/server";
import { validateVerificationToken, createVerifiedToken } from "@/lib/mfa";
import { getSubdomainUrl } from "@/lib/env-domains";

/**
 * GET /api/auth/verify/[token]
 *
 * Handles magic link clicks from verification emails.
 * Validates the token from the database, marks it as used, and redirects
 * the user to the login page with a signed proof of verification.
 *
 * For EMAIL_LOGIN: redirects with ?emailLoginToken=<signed>
 * For MFA_CHALLENGE: redirects with ?mfaVerified=<signed>
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const loginUrl = getSubdomainUrl("login");

  const result = await validateVerificationToken(token);

  if (!result) {
    const errorUrl = new URL("/login", loginUrl);
    errorUrl.searchParams.set("error", "VerificationExpired");
    return NextResponse.redirect(errorUrl.toString());
  }

  const verifiedToken = createVerifiedToken(result.email, result.type);

  const redirectUrl = new URL("/login", loginUrl);

  if (result.type === "EMAIL_LOGIN") {
    redirectUrl.searchParams.set("emailLoginToken", verifiedToken);
  } else {
    redirectUrl.searchParams.set("mfaVerified", verifiedToken);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
