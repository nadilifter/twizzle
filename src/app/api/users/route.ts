import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { z } from "zod";

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

    const users = await db.user.findMany({
      where: {
        organizationId: session.user.organizationId,
        // Exclude Uplifter staff (super admins) from organization user lists
        NOT: {
          email: {
            endsWith: "@uplifterinc.com",
          },
        },
      },
      include: {
        permissions: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Transform to match frontend expectations
    const transformedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role.toLowerCase(),
      permissions: user.permissions.map((p) => p.permission),
      status: user.status.toLowerCase(),
      joinedDate: user.createdAt,
      lastActive: user.lastActiveAt || user.createdAt,
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

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Get default permissions for role if not provided
    const permissions =
      validatedData.permissions ||
      ROLE_PERMISSIONS[validatedData.role] ||
      [];

    // Create user with temporary password (they'll reset it)
    const tempPassword = await hashPassword(Math.random().toString(36));

    const user = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        passwordHash: tempPassword,
        role: validatedData.role as "ADMIN" | "COACH" | "VOLUNTEER" | "ACCOUNTANT" | "CUSTOM",
        status: "INVITED",
        organizationId: session.user.organizationId,
        permissions: {
          create: permissions.map((p) => ({ permission: p })),
        },
      },
      include: {
        permissions: true,
      },
    });

    // TODO: Send invitation email

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      permissions: user.permissions.map((p) => p.permission),
      status: user.status.toLowerCase(),
      joinedDate: user.createdAt,
      lastActive: user.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
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
