import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
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

    const members = await db.organizationMember.findMany({
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

    return NextResponse.json(members);
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

    // Check if member already exists for this user+org
    const existingMember = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: validatedData.userId } },
    });

    if (existingMember) {
      // Update existing member with staff fields
      const updatedMember = await db.organizationMember.update({
        where: { id: existingMember.id },
        data: {
          employmentType: validatedData.employmentType || existingMember.employmentType || "FULL_TIME",
          title: validatedData.title ?? existingMember.title,
          hourlyRate: validatedData.hourlyRate ?? existingMember.hourlyRate,
          hireDate: validatedData.hireDate ? parseDateOnly(validatedData.hireDate) : existingMember.hireDate,
          certifications: validatedData.certifications ?? existingMember.certifications ?? undefined,
          phone: validatedData.phone ?? existingMember.phone,
          emergencyContact: validatedData.emergencyContact ?? existingMember.emergencyContact ?? undefined,
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

      return NextResponse.json(updatedMember, { status: 200 });
    }

    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: validatedData.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const member = await db.organizationMember.create({
      data: {
        organizationId,
        userId: validatedData.userId,
        employmentType: validatedData.employmentType || "FULL_TIME",
        title: validatedData.title ?? null,
        hourlyRate: validatedData.hourlyRate ?? null,
        hireDate: validatedData.hireDate ? parseDateOnly(validatedData.hireDate) : null,
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

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating staff profile:", error);
    return NextResponse.json({ error: "Failed to create staff profile" }, { status: 500 });
  }
}
