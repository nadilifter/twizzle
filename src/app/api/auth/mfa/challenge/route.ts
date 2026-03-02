import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { shouldRequireMfa, createVerificationCode, CODE_EXPIRY_MINUTES } from "@/lib/mfa";
import bcrypt from "bcryptjs";
import { z } from "zod";

const challengeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/mfa/challenge
 *
 * Pre-check endpoint called before signIn("credentials").
 * Validates the password and determines whether MFA is required.
 * If MFA is required, generates and emails a verification code.
 *
 * Returns { mfaRequired: false } or { mfaRequired: true }.
 * Always returns a generic 401 on bad credentials to prevent enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "mfa-challenge", RATE_LIMITS.mfaChallenge);

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
    const validated = challengeSchema.parse(body);
    const email = validated.email.toLowerCase().trim();

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, name: true, passwordHash: true, lastActiveAt: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: rateLimitHeaders(rateLimit) }
      );
    }

    const isValid = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: rateLimitHeaders(rateLimit) }
      );
    }

    if (!shouldRequireMfa(user.lastActiveAt)) {
      return NextResponse.json(
        { mfaRequired: false },
        { headers: rateLimitHeaders(rateLimit) }
      );
    }

    // MFA required — generate code and send email
    const { code, token } = await createVerificationCode(email, "MFA_CHALLENGE");

    const loginUrl = getSubdomainUrl("login");
    const verifyUrl = `${loginUrl}/api/auth/verify/${token}`;

    await sendTemplatedEmail("mfa-code", [email], {
      name: user.name || "there",
      code,
      verifyUrl,
      expiresIn: `${CODE_EXPIRY_MINUTES} minutes`,
    });

    return NextResponse.json(
      { mfaRequired: true },
      { headers: rateLimitHeaders(rateLimit) }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("MFA challenge error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
