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
    const user = await db.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        permissions: true,
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
      role: user.role.toLowerCase(),
      permissions: user.permissions.map((p) => p.permission),
      status: user.status.toLowerCase(),
      joinedDate: user.createdAt,
      lastActive: user.lastActiveAt || user.createdAt,
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

    // Verify user belongs to same organization
    const existingUser = await db.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.email) updateData.email = validatedData.email;
    if (validatedData.role) updateData.role = validatedData.role;

    // Update user
    const user = await db.user.update({
      where: { id },
      data: updateData,
      include: {
        permissions: true,
      },
    });

    // Update permissions if provided
    if (validatedData.permissions) {
      // Delete existing permissions
      await db.userPermission.deleteMany({
        where: { userId: id },
      });

      // Create new permissions
      await db.userPermission.createMany({
        data: validatedData.permissions.map((p) => ({
          userId: id,
          permission: p,
        })),
      });
    }

    // Fetch updated user with permissions
    const updatedUser = await db.user.findUnique({
      where: { id },
      include: { permissions: true },
    });

    return NextResponse.json({
      id: updatedUser!.id,
      name: updatedUser!.name,
      email: updatedUser!.email,
      avatar: updatedUser!.avatar,
      role: updatedUser!.role.toLowerCase(),
      permissions: updatedUser!.permissions.map((p) => p.permission),
      status: updatedUser!.status.toLowerCase(),
      joinedDate: updatedUser!.createdAt,
      lastActive: updatedUser!.lastActiveAt || updatedUser!.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
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

    // Verify user belongs to same organization
    const existingUser = await db.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingUser) {
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
