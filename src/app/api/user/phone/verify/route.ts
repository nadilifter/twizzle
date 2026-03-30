import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { validateVerificationCode } from "@/lib/mfa";
import { normalizePhoneNumber } from "@/lib/twilio";
import { db } from "@/lib/db"; // tenant-isolation-ok: User is not a tenant model; updates only own profile
import { syncUserToSelfAthlete } from "@/lib/sync-self-athlete";

const verifyCodeSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
  code: z.string().min(1, "Verification code is required"),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "phone-verify-confirm",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, code } = verifyCodeSchema.parse(body);

    const normalized = normalizePhoneNumber(phone);

    const verified = await validateVerificationCode(normalized, code, "PHONE_VERIFICATION");

    if (!verified) {
      return NextResponse.json(
        { verified: false, error: "Invalid or expired code. Please try again." },
        { status: 400 }
      );
    }

    const user = await db.user.update({
      where: { id: session.user.id },
      data: {
        phone: normalized,
        phoneVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        phoneVerified: true,
        avatar: true,
        createdAt: true,
      },
    });

    await syncUserToSelfAthlete(session.user.id);

    return NextResponse.json({ verified: true, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error verifying phone code:", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
