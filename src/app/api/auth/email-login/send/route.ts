import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { createVerificationCode, CODE_EXPIRY_MINUTES } from "@/lib/mfa";
import { z } from "zod";

const sendCodeSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/auth/email-login/send
 *
 * Sends a passwordless sign-in code to the provided email address.
 * Always returns success to prevent user enumeration — if no account
 * exists, no email is sent but the response is identical.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "email-login-send", RATE_LIMITS.emailLoginSend);

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

    const body = await request.json();
    const validated = sendCodeSchema.parse(body);
    const email = validated.email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });

    const loginUrl = getSubdomainUrl("login");

    if (user && user.status === "ACTIVE") {
      const { code, token } = await createVerificationCode(email, "EMAIL_LOGIN");
      const verifyUrl = `${loginUrl}/api/auth/verify/${token}`;

      await sendTemplatedEmail("email-login-code", [email], {
        code,
        verifyUrl,
        expiresIn: `${CODE_EXPIRY_MINUTES} minutes`,
      });
    } else {
      const signupUrl = getSubdomainUrl("startup");
      await sendTemplatedEmail("no-account-login", [email], {
        email,
        signupUrl,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "If an account exists with this email, you will receive a sign-in code shortly.",
      },
      { headers: rateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Email login send error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
