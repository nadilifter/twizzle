import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "COACH", "VOLUNTEER", "ACCOUNTANT", "CUSTOM"]).optional(),
  permissions: z.array(z.string()).optional(),
});

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const member = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: session.user.organizationId,
      },
      include: {
        user: true,
        permissions: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatar: member.user.avatar,
      role: member.role.toLowerCase(),
      permissions: member.permissions.map((p) => p.permission),
      status: member.status.toLowerCase(),
      joinedDate: member.joinedAt,
      lastActive: member.user.lastActiveAt || member.joinedAt,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update a user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Verify user belongs to same organization via membership
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update user-level fields (name, email)
    const userUpdateData: Record<string, unknown> = {};
    if (validatedData.name) userUpdateData.name = validatedData.name;
    if (validatedData.email) userUpdateData.email = validatedData.email;

    if (Object.keys(userUpdateData).length > 0) {
      await db.user.update({
        where: { id },
        data: userUpdateData,
      });
    }

    // Update role on the membership
    if (validatedData.role) {
      await db.organizationMember.update({
        where: { id: membership.id },
        data: { role: validatedData.role },
      });
    }

    // Update permissions on the membership
    if (validatedData.permissions) {
      await db.orgMemberPermission.deleteMany({
        where: { memberId: membership.id },
      });

      await db.orgMemberPermission.createMany({
        data: validatedData.permissions.map((p) => ({
          memberId: membership.id,
          permission: p,
        })),
      });
    }

    // Fetch updated member with user and permissions
    const updatedMember = await db.organizationMember.findUnique({
      where: { id: membership.id },
      include: { user: true, permissions: true },
    });

    return NextResponse.json({
      id: updatedMember!.user.id,
      name: updatedMember!.user.name,
      email: updatedMember!.user.email,
      avatar: updatedMember!.user.avatar,
      role: updatedMember!.role.toLowerCase(),
      permissions: updatedMember!.permissions.map((p) => p.permission),
      status: updatedMember!.status.toLowerCase(),
      joinedDate: updatedMember!.joinedAt,
      lastActive: updatedMember!.user.lastActiveAt || updatedMember!.joinedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("users.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Verify user belongs to same organization via membership
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
