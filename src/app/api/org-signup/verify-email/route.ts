import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendTemplatedEmail } from "@/lib/email"
import { checkRateLimit, getClientIp, RATE_LIMITS, rateLimitHeaders } from "@/lib/rate-limit"
import { createVerificationCode, CODE_EXPIRY_MINUTES } from "@/lib/mfa"
import { z } from "zod"

const verifyEmailSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const rateLimit = await checkRateLimit(ip, "signup-verify-email", RATE_LIMITS.emailLoginSend)

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
      )
    }

    const body = await request.json()
    const validated = verifyEmailSchema.parse(body)
    const email = validated.email.toLowerCase().trim()

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      // Return same shape to prevent email enumeration
      return NextResponse.json(
        { sent: true },
        { headers: rateLimitHeaders(rateLimit) }
      )
    }

    const { code } = await createVerificationCode(email, "SIGNUP_VERIFICATION")

    await sendTemplatedEmail("signup-verification-code", [email], {
      code,
      expiresIn: `${CODE_EXPIRY_MINUTES} minutes`,
    })

    return NextResponse.json(
      { sent: true },
      { headers: rateLimitHeaders(rateLimit) }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }
    console.error("Signup email verification error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}
