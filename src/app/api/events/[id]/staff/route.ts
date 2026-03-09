import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { checkMemberCertifications } from "@/lib/services/certification-check";

const addEventStaffSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  role: z.enum(["LEAD", "ASSISTANT", "VOLUNTEER", "OBSERVER"]).optional(),
  notes: z.string().optional().nullable(),
});

// GET - List all staff assigned to an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id: eventId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const eventStaff = await db.eventStaff.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: [
        { role: "asc" }, // LEAD first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(eventStaff);
  } catch (error) {
    console.error("Error fetching event staff:", error);
    return NextResponse.json({ error: "Failed to fetch event staff" }, { status: 500 });
  }
}

// POST - Add staff to an event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      !session.user.permissions.includes("events.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: eventId } = await params;

    // Verify event exists in organization
    const event = await db.event.findFirst({
      where: { id: eventId, organizationId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = addEventStaffSchema.parse(body);

    // Verify member belongs to organization
    const member = await db.organizationMember.findFirst({
      where: { id: validatedData.memberId, organizationId },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Certification enforcement (skip with ?skipCertCheck=true)
    const url = new URL(request.url);
    const skipCertCheck = url.searchParams.get("skipCertCheck") === "true";
    if (!skipCertCheck) {
      const certResult = await checkMemberCertifications(
        organizationId,
        validatedData.memberId,
        "events"
      );
      if (!certResult.valid) {
        return NextResponse.json(
          {
            error: "Missing required certifications",
            certifications: certResult.missing,
          },
          { status: 422 }
        );
      }
    }

    // Check if staff is already assigned to event
    const existingAssignment = await db.eventStaff.findUnique({
      where: {
        eventId_memberId: {
          eventId,
          memberId: validatedData.memberId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json({ error: "Staff member is already assigned to this event" }, { status: 400 });
    }

    const eventStaff = await db.eventStaff.create({
      data: {
        eventId,
        memberId: validatedData.memberId,
        role: validatedData.role || "ASSISTANT",
        notes: validatedData.notes ?? null,
      },
      include: {
        member: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(eventStaff, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding event staff:", error);
    return NextResponse.json({ error: "Failed to add event staff" }, { status: 500 });
  }
}
