import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit";
import { validateVerificationCode } from "@/lib/mfa";
import { z } from "zod";

const confirmSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1, "Code is required"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "signup-verify-confirm", RATE_LIMITS.auth);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too many requests",
          message: "Please wait a moment before trying again.",
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
    const validated = confirmSchema.parse(body);
    const email = validated.email.toLowerCase().trim();

    const verified = await validateVerificationCode(email, validated.code, "SIGNUP_VERIFICATION");

    return NextResponse.json({ verified }, { headers: rateLimitHeaders(rateLimit) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Signup verification confirm error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    );
  }
}
