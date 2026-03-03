import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";

const acceptInvitationSchema = z.object({
  password: passwordSchema.optional(),
  confirmPassword: z.string().optional(),
}).refine(
  (data) => {
    // If password is provided, confirmPassword must match
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
          errorCode: "INVALID_TOKEN"
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
          errorCode: "ALREADY_ACCEPTED"
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
          error: "This invitation has expired. Please contact the administrator for a new invitation.",
          errorCode: "EXPIRED"
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
          errorCode: "CANCELLED"
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

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "This invitation has expired" },
        { status: 400 }
      );
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { email: invitation.email },
      select: { 
        id: true, 
        passwordHash: true, 
        status: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const needsPassword = !user.passwordHash || user.status === "INVITED";

    // For new users (no password), require password in body
    if (needsPassword) {
      const validatedData = acceptInvitationSchema.parse(body);

      if (!validatedData.password) {
        return NextResponse.json(
          { success: false, error: "Password is required" },
          { status: 400 }
        );
      }

      // Hash the password
      const passwordHash = await hashPassword(validatedData.password);

      // Accept invitation in transaction
      await db.$transaction(async (tx) => {
        // Update invitation status
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        // Update organization member status
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

        // Update user: set password, activate, set active organization
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: "ACTIVE",
            organizationId: invitation.organizationId,
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
      // Existing user flow - verify they are authenticated
      const session = await getAuthSession();
      
      if (!session) {
        // Return special code so frontend knows to redirect to login
        return NextResponse.json(
          { 
            success: false, 
            error: "Please log in to accept this invitation",
            requiresAuth: true,
            redirectUrl: `/login?callbackUrl=/accept-invitation?token=${token}`,
          },
          { status: 401 }
        );
      }

      // Verify the logged-in user matches the invitation email
      if (session.user.email !== invitation.email) {
        return NextResponse.json(
          { 
            success: false, 
            error: `This invitation was sent to ${invitation.email}. Please log in with that account.`,
          },
          { status: 403 }
        );
      }

      // Accept invitation in transaction
      await db.$transaction(async (tx) => {
        // Update invitation status
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
          },
        });

        // Update organization member status
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

        // Set user's active organization to the newly joined one
        await tx.user.update({
          where: { id: user.id },
          data: {
            organizationId: invitation.organizationId,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Welcome to ${invitation.organization.name}!`,
        redirectUrl: "/dashboard",
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error accepting invitation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to accept invitation" },
      { status: 500 }
    );
  }
}
