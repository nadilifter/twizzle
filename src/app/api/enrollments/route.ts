import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createEnrollmentSchema = z.object({
  athleteId: z.string().min(1, "Athlete is required"),
  programId: z.string().min(1, "Program is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "COMPLETED"]).default("ACTIVE"),
  userId: z.string().optional(),
});

// GET /api/enrollments
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const athleteId = searchParams.get("athleteId");
    const programId = searchParams.get("programId");
    const status = searchParams.get("status");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Prisma.EnrollmentWhereInput = {
      athlete: {
        is: {
          organizationAthletes: {
            some: { organizationId: session.user.organizationId },
          },
        },
      },
      ...(athleteId && { athleteId }),
      ...(programId && { programId }),
      ...(status && { status: status as "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED" }),
    };

    if (userId) {
      where.userId = userId;
    }

    const [enrollments, total] = await Promise.all([
      db.enrollment.findMany({
        where,
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
            },
          },
          program: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.enrollment.count({ where }),
    ]);

    return NextResponse.json({
      data: enrollments,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    );
  }
}

// POST /api/enrollments - Enroll an athlete in a program
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("athletes.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createEnrollmentSchema.parse(body);

    // Verify athlete is visible to this organization
    const athlete = await db.athlete.findFirst({
      where: {
        id: validatedData.athleteId,
        organizationAthletes: {
          some: { organizationId: session.user.organizationId },
        },
      },
    });

    if (!athlete) {
      return NextResponse.json({ error: "Athlete not found" }, { status: 404 });
    }

    const userId = validatedData.userId ?? session.user.id;

    // Verify program belongs to the organization
    const program = await db.program.findFirst({
      where: {
        id: validatedData.programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Check for existing active enrollment
    const existingEnrollment = await db.enrollment.findFirst({
      where: {
        athleteId: validatedData.athleteId,
        programId: validatedData.programId,
        status: "ACTIVE",
      },
    });

    if (existingEnrollment) {
      return NextResponse.json(
        { error: "Athlete is already enrolled in this program" },
        { status: 400 }
      );
    }

    const enrollment = await db.enrollment.create({
      data: {
        athleteId: validatedData.athleteId,
        programId: validatedData.programId,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
        status: validatedData.status,
        ...(userId != null ? { userId } : {}),
      },
      include: {
        athlete: true,
        program: true,
      },
    });

    return NextResponse.json(enrollment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating enrollment:", error);
    return NextResponse.json(
      { error: "Failed to create enrollment" },
      { status: 500 }
    );
  }
}
