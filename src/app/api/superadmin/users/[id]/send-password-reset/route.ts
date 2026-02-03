import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";
import crypto from "crypto";

// Token expiration time: 1 hour
const TOKEN_EXPIRATION_MS = 60 * 60 * 1000;

/**
 * POST /api/superadmin/users/[id]/send-password-reset
 * 
 * Allows superadmins to send a password reset email to any user.
 * Requires superadmin access.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await params;

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Generate a reset token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

    // Invalidate any existing tokens for this email
    await db.passwordResetToken.updateMany({
      where: {
        email: user.email,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Create new token
    await db.passwordResetToken.create({
      data: {
        email: user.email,
        token,
        expiresAt,
      },
    });

    // Build reset URL
    const loginUrl = getSubdomainUrl("login");
    const resetUrl = `${loginUrl}/reset-password?token=${token}`;

    // Send password reset email
    await sendTemplatedEmail("password-reset", [user.email], {
      name: user.name || "there",
      resetUrl,
      expiresIn: "1 hour",
    });

    return NextResponse.json({
      success: true,
      message: `Password reset email sent to ${user.email}`,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return NextResponse.json(
      { error: "Failed to send password reset email" },
      { status: 500 }
    );
  }
}
