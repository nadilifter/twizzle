import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET /api/programs/[id]/waitlist — list waitlisted enrollments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId } = await params;

    const program = await db.program.findFirst({
      where: { id: programId, organizationId: session.user.organizationId },
      select: { id: true, waitlistEnabled: true, waitlistAutoPromote: true, waitlistCapacity: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const waitlisted = await db.enrollment.findMany({
      where: { programId, status: "WAITLISTED" },
      include: {
        athlete: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      program: {
        id: program.id,
        waitlistEnabled: program.waitlistEnabled,
        waitlistAutoPromote: program.waitlistAutoPromote,
        waitlistCapacity: program.waitlistCapacity,
      },
      waitlisted: waitlisted.map((e, index) => ({
        id: e.id,
        position: index + 1,
        athleteId: e.athleteId,
        athlete: e.athlete,
        joinedAt: e.createdAt,
      })),
      count: waitlisted.length,
    });
  } catch (error) {
    console.error("Error fetching waitlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist" },
      { status: 500 }
    );
  }
}

const promoteSchema = z.object({
  enrollmentId: z.string().optional(),
});

// POST /api/programs/[id]/waitlist — promote a waitlisted enrollment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("registrations.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;
    const body = await request.json();
    const { enrollmentId } = promoteSchema.parse(body);

    const program = await db.program.findFirst({
      where: { id: programId, organizationId: session.user.organizationId },
      select: { id: true, waitlistEnabled: true },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Find the enrollment to promote
    const enrollment = enrollmentId
      ? await db.enrollment.findFirst({
          where: { id: enrollmentId, programId, status: "WAITLISTED" },
        })
      : await db.enrollment.findFirst({
          where: { programId, status: "WAITLISTED" },
          orderBy: { createdAt: "asc" },
        });

    if (!enrollment) {
      return NextResponse.json(
        { error: "No waitlisted enrollment found" },
        { status: 404 }
      );
    }

    // Promote the enrollment
    await db.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "ACTIVE" },
    });

    // Create instance registrations for all non-cancelled instances
    const instances = await db.programInstance.findMany({
      where: { programId, status: { not: "CANCELLED" } },
      select: { id: true },
    });

    for (const inst of instances) {
      await db.instanceRegistration.upsert({
        where: {
          programInstanceId_athleteId: {
            programInstanceId: inst.id,
            athleteId: enrollment.athleteId,
          },
        },
        update: { status: "REGISTERED" },
        create: {
          programInstanceId: inst.id,
          athleteId: enrollment.athleteId,
          userId: enrollment.userId || undefined,
          status: "REGISTERED",
        },
      });
    }

    return NextResponse.json({
      success: true,
      enrollmentId: enrollment.id,
      athleteId: enrollment.athleteId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error promoting from waitlist:", error);
    return NextResponse.json(
      { error: "Failed to promote from waitlist" },
      { status: 500 }
    );
  }
}
