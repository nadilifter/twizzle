import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * GET /api/auth/reset-password/[token]
 *
 * Validate a password reset token and return basic info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid or expired reset link. Please request a new password reset.",
          errorCode: "INVALID_TOKEN",
        },
        { status: 404 }
      );
    }

    // Check if already used
    if (resetToken.usedAt) {
      return NextResponse.json(
        {
          valid: false,
          error: "This reset link has already been used. Please request a new password reset.",
          errorCode: "TOKEN_USED",
        },
        { status: 400 }
      );
    }

    // Check if expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        {
          valid: false,
          error: "This reset link has expired. Please request a new password reset.",
          errorCode: "TOKEN_EXPIRED",
        },
        { status: 400 }
      );
    }

    // Token is valid - return masked email for confirmation
    const email = resetToken.email;
    const maskedEmail = maskEmail(email);

    const user = await db.user.findUnique({
      where: { email },
      select: { passwordHash: true },
    });

    return NextResponse.json({
      valid: true,
      email: maskedEmail,
      hasPassword: !!user?.passwordHash,
    });
  } catch (error) {
    console.error("Error validating reset token:", error);
    return NextResponse.json(
      { valid: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password/[token]
 *
 * Reset the user's password using a valid token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = resetPasswordSchema.parse(body);

    // Find the token
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired reset link." },
        { status: 404 }
      );
    }

    // Check if already used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { success: false, error: "This reset link has already been used." },
        { status: 400 }
      );
    }

    // Check if expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This reset link has expired." },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      // This shouldn't happen, but handle it gracefully
      return NextResponse.json({ success: false, error: "Account not found." }, { status: 404 });
    }

    // Hash the new password
    const passwordHash = await hashPassword(validatedData.password);

    // Update user password and mark token as used in a transaction.
    // Always activate the user — covers first-time account creation (INVITED)
    // as well as standard password resets.
    // Also activates any INVITED OrganizationMember records (no-op if none exist).
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash, status: "ACTIVE" },
      }),
      // tenant-isolation-ok: intentionally activates all INVITED memberships across
      // orgs — when a user creates their password they become active everywhere invited.
      db.organizationMember.updateMany({
        where: { userId: user.id, status: "INVITED" },
        data: { status: "ACTIVE" },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({
      success: true,
      email: resetToken.email,
      message:
        "Your password has been reset successfully. You can now log in with your new password.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { success: false, error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Mask an email address for privacy (e.g., "john@example.com" -> "j***@e***.com")
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  const [domainName, ...tld] = domain.split(".");

  const maskedLocal = localPart.length > 2 ? localPart[0] + "***" : localPart[0] + "*";

  const maskedDomain = domainName.length > 2 ? domainName[0] + "***" : domainName[0] + "*";

  return `${maskedLocal}@${maskedDomain}.${tld.join(".")}`;
}
