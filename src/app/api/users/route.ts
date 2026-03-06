import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { sendTemplatedEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/env-domains";
import { z } from "zod";
import crypto from "crypto";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["ADMIN", "COACH", "VOLUNTEER", "ACCOUNTANT", "CUSTOM"]),
  permissions: z.array(z.string()).optional(),
});

// GET /api/users - List users for the organization
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get users who are members of this organization
    const members = await db.organizationMember.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      include: {
        user: true,
        permissions: true,
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    // Transform to match frontend expectations, excluding Uplifter staff
    const transformedUsers = members
      .filter((m) => !m.user.email.endsWith("@uplifterinc.com"))
      .map((member) => ({
        id: member.user.id,
        memberId: member.id,
        name: member.user.name,
        email: member.user.email,
        avatar: member.user.avatar,
        role: member.role.toLowerCase(),
        permissions: member.permissions.map((p) => p.permission),
        status: member.status.toLowerCase(),
        joinedDate: member.joinedAt,
        lastActive: member.user.lastActiveAt || member.joinedAt,
        title: member.title,
        employmentType: member.employmentType,
      }));

    return NextResponse.json(transformedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create/invite a new user
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createUserSchema.parse(body);

    // Get organization details for the email
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
      include: { memberships: true },
    });

    // Get default permissions for role if not provided
    const permissions =
      validatedData.permissions ||
      ROLE_PERMISSIONS[validatedData.role] ||
      [];

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Get base URL for invitation link
    const baseUrl = getBaseUrl();
    const inviteUrl = `${baseUrl}/accept-invitation?token=${invitationToken}`;

    if (existingUser) {
      // EXISTING USER FLOW
      // Check if already a member of this organization
      const existingMembership = existingUser.memberships.find(
        (m) => m.organizationId === session.user.organizationId
      );

      if (existingMembership) {
        return NextResponse.json(
          { error: "User is already a member of this organization" },
          { status: 400 }
        );
      }

      // Create membership + invitation in transaction
      await db.$transaction(async (tx) => {
        await tx.organizationMember.create({
          data: {
            organizationId: session.user.organizationId,
            userId: existingUser.id,
            role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
            status: "INVITED",
          },
        });

        await tx.organizationInvitation.create({
          data: {
            email: validatedData.email,
            token: invitationToken,
            organizationId: session.user.organizationId,
            role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
            invitedById: session.user.id,
            expiresAt,
          },
        });
      });

      // Send "Join Organization" email for existing users
      await sendTemplatedEmail("invitation-existing-user", [existingUser.email], {
        name: existingUser.name,
        inviterName: session.user.name || "A team member",
        organizationName: organization.name,
        joinUrl: inviteUrl,
      });

      return NextResponse.json({
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: validatedData.role.toLowerCase(),
        permissions: existingUser.memberships.length > 0 ? [] : permissions, // Existing user keeps their permissions
        status: "invited",
        joinedDate: new Date(),
        lastActive: existingUser.lastActiveAt || new Date(),
        isExistingUser: true,
      });
    } else {
      // NEW USER FLOW
      // Create user + membership + invitation in transaction
      const newUser = await db.$transaction(async (tx) => {
        // Create user with no password (they'll set it when accepting)
        const user = await tx.user.create({
          data: {
            name: validatedData.name,
            email: validatedData.email,
            role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
            status: "INVITED",
          },
        });

        await tx.organizationMember.create({
          data: {
            organizationId: session.user.organizationId,
            userId: user.id,
            role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
            status: "INVITED",
            permissions: {
              create: permissions.map((p) => ({ permission: p })),
            },
          },
        });

        await tx.organizationInvitation.create({
          data: {
            email: validatedData.email,
            token: invitationToken,
            organizationId: session.user.organizationId,
            role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
            invitedById: session.user.id,
            expiresAt,
          },
        });

        return user;
      });

      // Send "Setup Account" email for new users
      await sendTemplatedEmail("invitation", [newUser.email], {
        inviterName: session.user.name || "A team member",
        organizationName: organization.name,
        inviteUrl,
      });

      return NextResponse.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role.toLowerCase(),
        permissions,
        status: newUser.status.toLowerCase(),
        joinedDate: newUser.createdAt,
        lastActive: newUser.createdAt,
        isExistingUser: false,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
