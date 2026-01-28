import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { checkAuthRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const nextAuthHandler = NextAuth(authOptions);

/**
 * GET handler - Used for CSRF token, session, etc.
 * These don't need strict rate limiting as they're not login attempts.
 */
export async function GET(request: NextRequest, context: { params: { nextauth: string[] } }) {
  return nextAuthHandler(request, context);
}

/**
 * POST handler - Used for credential login, signout, etc.
 * Apply rate limiting to prevent brute force attacks.
 */
export async function POST(request: NextRequest, context: { params: { nextauth: string[] } }) {
  const action = context.params.nextauth?.[0];
  
  // Apply strict rate limiting for credential sign-in attempts
  if (action === "callback" || action === "signin") {
    const rateLimitResponse = await checkAuthRateLimit(request, RATE_LIMITS.auth);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
  }

  return nextAuthHandler(request, context);
}
