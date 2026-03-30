import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import crypto from "crypto";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

// Token expiration time: 1 hour
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * POST /api/auth/forgot-password
 *
 * Request a password reset email. Always returns success to prevent user enumeration.
 * If the user exists, sends a reset email. If not, sends a "no account" notification.
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "password-reset", RATE_LIMITS.passwordReset);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please wait a few minutes before trying again.",
          retryAfter: Math.ceil((rateLimit.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((rateLimit.reset - Date.now()) / 1000).toString(),
            ...rateLimitHeaders(rateLimit),
          },
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);
    const email = validatedData.email.toLowerCase().trim();

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    // Get the login subdomain URL for the reset link
    const loginUrl = getSubdomainUrl("login");
    const signupUrl = `${loginUrl.replace("login.", "")}/org-signup`;

    if (user) {
      // User exists - generate a reset token
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

      // Invalidate any existing tokens for this email
      await db.passwordResetToken.updateMany({
        where: {
          email,
          usedAt: null,
        },
        data: {
          usedAt: new Date(), // Mark as used to invalidate
        },
      });

      // Create new token
      await db.passwordResetToken.create({
        data: {
          email,
          token,
          expiresAt,
        },
      });

      // Build reset URL
      const resetUrl = `${loginUrl}/reset-password?token=${token}`;

      // Send password reset email
      await sendTemplatedEmail("password-reset", [email], {
        name: user.name || "there",
        resetUrl,
        expiresIn: "1 hour",
      });
    } else {
      // User doesn't exist - send no-account notification
      await sendTemplatedEmail("no-account", [email], {
        email,
        signupUrl,
      });
    }

    // Always return success to prevent user enumeration
    return NextResponse.json(
      {
        success: true,
        message:
          "If an account exists with this email, you will receive a password reset link shortly.",
      },
      {
        headers: rateLimitHeaders(rateLimit),
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
