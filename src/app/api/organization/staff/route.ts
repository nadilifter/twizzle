import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createStaffSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACTOR", "VOLUNTEER"]).optional(),
  title: z.string().optional().nullable(),
  hourlyRate: z.number().optional().nullable(),
  hireDate: z.string().optional().nullable(), // ISO date string
  certifications: z.array(z.object({
    name: z.string(),
    expiresAt: z.string().optional().nullable(),
    verified: z.boolean().optional(),
  })).optional().nullable(),
  phone: z.string().optional().nullable(),
  emergencyContact: z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string().optional(),
  }).optional().nullable(),
});

// GET - List all staff profiles for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("staff.view")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const staffProfiles = await db.staffProfile.findMany({
      where: {
        organizationId,
        ...(search && {
          OR: [
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { title: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
          },
        },
      },
      orderBy: [
        { user: { name: "asc" } },
      ],
    });

    return NextResponse.json(staffProfiles);
  } catch (error) {
    console.error("Error fetching staff:", error);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

// POST - Create a new staff profile
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Check permissions
    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("staff.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createStaffSchema.parse(body);

    // Check if user exists and belongs to organization
    const user = await db.user.findFirst({
      where: {
        id: validatedData.userId,
        organizationId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found in this organization" }, { status: 404 });
    }

    // Check if staff profile already exists for this user
    const existingProfile = await db.staffProfile.findUnique({
      where: { userId: validatedData.userId },
    });

    if (existingProfile) {
      return NextResponse.json({ error: "Staff profile already exists for this user" }, { status: 400 });
    }

    const staffProfile = await db.staffProfile.create({
      data: {
        organizationId,
        userId: validatedData.userId,
        employmentType: validatedData.employmentType || "FULL_TIME",
        title: validatedData.title ?? null,
        hourlyRate: validatedData.hourlyRate ?? null,
        hireDate: validatedData.hireDate ? new Date(validatedData.hireDate) : null,
        certifications: validatedData.certifications ?? undefined,
        phone: validatedData.phone ?? null,
        emergencyContact: validatedData.emergencyContact ?? undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            shifts: true,
            eventAssignments: true,
          },
        },
      },
    });

    return NextResponse.json(staffProfile, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating staff profile:", error);
    return NextResponse.json({ error: "Failed to create staff profile" }, { status: 500 });
  }
}
