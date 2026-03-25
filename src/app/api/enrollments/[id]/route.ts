import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";
import { promoteFromWaitlist } from "@/lib/waitlist-promotion";

const updateEnrollmentSchema = z.object({
  status: z.enum(["ACTIVE", "WAITLISTED", "PAUSED", "CANCELLED", "COMPLETED"]).optional(),
  endDate: z.string().optional().nullable(),
});

async function getOrgEnrollment(enrollmentId: string, organizationId: string) {
  return db.enrollment.findFirst({
    where: {
      id: enrollmentId,
      athlete: {
        organizationAthletes: {
          some: { organizationId },
        },
      },
    },
    include: {
      athlete: {
        select: { id: true, name: true },
      },
      program: true,
    },
  });
}

// GET /api/enrollments/[id]
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
    const enrollment = await getOrgEnrollment(id, session.user.organizationId);

    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    console.error("Error fetching enrollment:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrollment" },
      { status: 500 }
    );
  }
}

// PATCH /api/enrollments/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("athletes.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getOrgEnrollment(id, session.user.organizationId);

    if (!existing) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateEnrollmentSchema.parse(body);

    const wasCancellingActive =
      existing.status === "ACTIVE" && validatedData.status === "CANCELLED";

    const enrollment = await db.enrollment.update({
      where: { id, program: { organizationId: session.user.organizationId } },
      data: {
        ...(validatedData.status && { status: validatedData.status }),
        ...(validatedData.endDate !== undefined && {
          endDate: validatedData.endDate ? parseDateOnly(validatedData.endDate) : null,
        }),
      },
      include: {
        athlete: {
          select: { id: true, name: true },
        },
        program: true,
      },
    });

    // Cancel linked recurring charges and auto-promote from waitlist
    if (wasCancellingActive) {
      await db.recurringCharge.updateMany({
        where: {
          enrollmentId: id,
          status: { in: ["ACTIVE", "PAUSED", "FAILED"] },
        },
        data: { status: "CANCELLED" },
      });

      promoteFromWaitlist(existing.programId).catch((err) =>
        console.error("Waitlist promotion failed:", err)
      );
    }

    return NextResponse.json(enrollment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating enrollment:", error);
    return NextResponse.json(
      { error: "Failed to update enrollment" },
      { status: 500 }
    );
  }
}

// DELETE /api/enrollments/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("athletes.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await getOrgEnrollment(id, session.user.organizationId);

    if (!existing) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const wasActive = existing.status === "ACTIVE";

    // Cancel linked recurring charges before deletion (SetNull would orphan them)
    await db.recurringCharge.updateMany({
      where: {
        enrollmentId: id,
        status: { in: ["ACTIVE", "PAUSED", "FAILED"] },
      },
      data: { status: "CANCELLED" },
    });

    await db.enrollment.delete({
      where: { id, program: { organizationId: session.user.organizationId } },
    });

    if (wasActive) {
      promoteFromWaitlist(existing.programId).catch((err) =>
        console.error("Waitlist promotion failed:", err)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return NextResponse.json(
      { error: "Failed to delete enrollment" },
      { status: 500 }
    );
  }
}
