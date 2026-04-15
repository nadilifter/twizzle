import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";
import { checkApiRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { buildSmsConsentGrant } from "@/lib/sms-consent";

const acceptInvitationSchema = z
  .object({
    password: passwordSchema.optional(),
    confirmPassword: z.string().optional(),
    acceptedTerms: z.boolean().optional(),
    // Optional SMS opt-in — never required to accept the invitation.
    smsConsent: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.password && data.confirmPassword) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    { message: "Passwords do not match", path: ["confirmPassword"] }
  );

// GET /api/invitations/[token] - Validate invitation and return details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rateLimited = await checkApiRateLimit(request, "invitations", RATE_LIMITS.sensitive, {
    failClosed: true,
  });
  if (rateLimited) return rateLimited;

  try {
    const { token } = await params;

    // Find the invitation
    const invitation = await db.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        invitedBy: {
          select: { name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid invitation link",
          errorCode: "INVALID_TOKEN",
        },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        {
          valid: false,
          error: "This invitation has already been accepted",
          errorCode: "ALREADY_ACCEPTED",
        },
        { status: 400 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      // Update status to expired
      await db.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        {
          valid: false,
          error:
            "This invitation has expired. Please contact the administrator for a new invitation.",
          errorCode: "EXPIRED",
        },
        { status: 400 }
      );
    }

    // Check if expired by superseding re-invite (status set to EXPIRED but expiresAt still in future)
    if (invitation.status === "EXPIRED") {
      return NextResponse.json(
        {
          valid: false,
          error:
            "This invitation has expired. Please contact the administrator for a new invitation.",
          errorCode: "EXPIRED",
        },
        { status: 400 }
      );
    }

    // Check if cancelled
    if (invitation.status === "CANCELLED") {
      return NextResponse.json(
        {
          valid: false,
          error: "This invitation has been cancelled",
          errorCode: "CANCELLED",
        },
        { status: 400 }
      );
    }

    // Check if user already exists (to determine if they need to set password)
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        status: true,
        termsAcceptedAt: true,
      },
    });

    // User exists and has a password = existing user flow
    // User exists but no password = new user who needs to set password
    // User doesn't exist = shouldn't happen if invitation was created properly
    const userExists = !!existingUser;
    const needsPassword = !existingUser?.passwordHash || existingUser.status === "INVITED";

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        organizationId: invitation.organization.id,
        organizationName: invitation.organization.name,
        role: invitation.role.toLowerCase(),
        inviterName: invitation.invitedBy.name,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      user: {
        exists: userExists,
        name: existingUser?.name || null,
        email: invitation.email,
        needsPassword,
        hasAcceptedTerms: !!existingUser?.termsAcceptedAt,
      },
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to validate invitation" },
      { status: 500 }
    );
  }
}

// POST /api/invitations/[token] - Accept invitation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const rateLimited = await checkApiRateLimit(request, "invitations", RATE_LIMITS.sensitive, {
    failClosed: true,
  });
  if (rateLimited) return rateLimited;

  try {
    const { token } = await params;
    const body = await request.json();

    // Find the invitation
    const invitation = await db.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: "Invalid invitation link" },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.status === "ACCEPTED") {
      return NextResponse.json(
        { success: false, error: "This invitation has already been accepted" },
        { status: 400 }
      );
    }

    // Check if expired (by time or by superseding re-invite)
    if (invitation.status === "EXPIRED" || invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invitation has expired" },
        { status: 400 }
      );
    }

    const validatedData = acceptInvitationSchema.parse(body);

    // Find the user
    const user = await db.user.findUnique({
      where: { email: invitation.email },
      select: {
        id: true,
        passwordHash: true,
        status: true,
        termsAcceptedAt: true,
        smsConsentAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const needsPassword = !user.passwordHash || user.status === "INVITED";
    const needsTermsAcceptance = !user.termsAcceptedAt;

    if (needsTermsAcceptance && validatedData.acceptedTerms !== true) {
      return NextResponse.json(
        { success: false, error: "You must accept the terms and conditions" },
        { status: 400 }
      );
    }

    // For new users (no password), require password in body
    if (needsPassword) {
      if (!validatedData.password) {
        return NextResponse.json(
          { success: false, error: "Password is required" },
          { status: 400 }
        );
      }

      const passwordHash = await hashPassword(validatedData.password);
      const ip = getClientIp(request);
      // Only grant consent from this surface if the user has none on record.
      // An existing consent (even one that was later revoked and is now null)
      // shouldn't be silently overwritten to source=INVITATION from this path;
      // users who've already consented via a stronger source (e.g.
      // ACCOUNT_SETTINGS) or who have revoked keep that state.
      const smsConsentData =
        validatedData.smsConsent && !user.smsConsentAt
          ? buildSmsConsentGrant("INVITATION", ip === "unknown" ? null : ip)
          : null;

      await db.$transaction(async (tx) => {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        await tx.organizationMember.updateMany({
          where: {
            organizationId: invitation.organizationId,
            userId: user.id,
            status: "INVITED",
          },
          data: {
            status: "ACTIVE",
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: "ACTIVE",
            ...(needsTermsAcceptance && { termsAcceptedAt: new Date() }),
            ...(smsConsentData ?? {}),
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Account created successfully",
        redirectUrl: "/dashboard",
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
      });
    } else {
      // Existing user -- the token itself proves they have access to the
      // invited email address, so no session/login is required.
      const ip = getClientIp(request);
      // Only grant consent here if the user has none on record; don't
      // overwrite a stronger prior consent (e.g. ACCOUNT_SETTINGS) with a
      // weaker INVITATION-sourced record.
      const smsConsentData =
        validatedData.smsConsent && !user.smsConsentAt
          ? buildSmsConsentGrant("INVITATION", ip === "unknown" ? null : ip)
          : null;

      await db.$transaction(async (tx) => {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        await tx.organizationMember.updateMany({
          where: {
            organizationId: invitation.organizationId,
            userId: user.id,
            status: "INVITED",
          },
          data: {
            status: "ACTIVE",
          },
        });

        const userUpdate = {
          ...(needsTermsAcceptance && { termsAcceptedAt: new Date() }),
          ...(smsConsentData ?? {}),
        };
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: userUpdate,
          });
        }
      });

      return NextResponse.json({
        success: true,
        message: `Welcome to ${invitation.organization.name}!`,
        email: invitation.email,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
