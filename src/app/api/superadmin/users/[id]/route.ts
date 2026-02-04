import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "COACH", "STAFF", "VOLUNTEER", "ACCOUNTANT", "PARENT", "CUSTOM"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "INVITED"]).optional(),
  isSuperAdmin: z.boolean().optional(),
});

/**
 * GET /api/superadmin/users/[id]
 * 
 * Get a specific user by ID. Requires superadmin access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        permissions: true,
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions.map((p) => p.permission),
      memberships: user.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        organization: m.organization,
      })),
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/superadmin/users/[id]
 * 
 * Update a user's details. Requires superadmin access.
 * Superadmins can update any user, including name, email, role, status, and superadmin flag.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // Verify user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent removing superadmin status from yourself
    if (
      id === session.user.id &&
      validatedData.isSuperAdmin === false
    ) {
      return NextResponse.json(
        { error: "You cannot remove your own superadmin status" },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.email !== undefined) updateData.email = validatedData.email;
    if (validatedData.role !== undefined) updateData.role = validatedData.role;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.isSuperAdmin !== undefined) updateData.isSuperAdmin = validatedData.isSuperAdmin;

    // Update user
    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        permissions: true,
        memberships: {
          include: {
            organization: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // If granting superadmin status, ensure wildcard permission exists
    if (validatedData.isSuperAdmin === true) {
      await db.userPermission.upsert({
        where: {
          userId_permission: {
            userId: id,
            permission: "*",
          },
        },
        create: {
          userId: id,
          permission: "*",
        },
        update: {},
      });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatar: updatedUser.avatar,
      role: updatedUser.role,
      status: updatedUser.status,
      isSuperAdmin: updatedUser.isSuperAdmin,
      permissions: updatedUser.permissions.map((p) => p.permission),
      memberships: updatedUser.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        organization: m.organization,
      })),
      createdAt: updatedUser.createdAt,
      lastActiveAt: updatedUser.lastActiveAt,
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

/**
 * DELETE /api/superadmin/users/[id]
 * 
 * Delete a user. Requires superadmin access.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Verify user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user (cascades to permissions, accounts, etc. based on schema)
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
