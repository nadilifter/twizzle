import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkApiRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { createVerificationCode, CODE_EXPIRY_MINUTES } from "@/lib/mfa";
import { sendSms, normalizePhoneNumber, isValidE164 } from "@/lib/twilio";

const sendCodeSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine((val) => isValidPhoneNumber(val), "Please enter a valid phone number"),
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkApiRateLimit(
    request,
    "phone-verify-send",
    RATE_LIMITS.sensitive
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone } = sendCodeSchema.parse(body);

    const normalized = normalizePhoneNumber(phone);
    if (!isValidE164(normalized)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const { code } = await createVerificationCode(
      normalized,
      "PHONE_VERIFICATION"
    );

    const result = await sendSms({
      to: normalized,
      body: `Your verification code is ${code}. It expires in ${CODE_EXPIRY_MINUTES} minutes.`,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error sending phone verification code:", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
