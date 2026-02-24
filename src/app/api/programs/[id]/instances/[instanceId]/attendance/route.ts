import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// AttendanceStatus enum from schema: REGISTERED, PRESENT, ABSENT, LATE, EXCUSED
const createAttendanceSchema = z.object({
  athleteId: z.string(),
  status: z.enum(["REGISTERED", "PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
  checkedIn: z.boolean().optional().default(true), // Will be converted to DateTime
  notes: z.string().optional().nullable(),
});

const bulkAttendanceSchema = z.object({
  attendances: z.array(z.object({
    athleteId: z.string(),
    status: z.enum(["REGISTERED", "PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
    checkedIn: z.boolean().optional().default(true), // Will be converted to DateTime
    notes: z.string().optional().nullable(),
  })),
});

// Helper to convert boolean checkedIn to DateTime
function getCheckedInTime(checkedIn: boolean | undefined): Date | null {
  return checkedIn ? new Date() : null;
}

// GET /api/programs/[id]/instances/[instanceId]/attendance
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: programId, instanceId } = await params;

    // Verify instance exists and belongs to organization
    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const attendances = await db.instanceAttendance.findMany({
      where: { programInstanceId: instanceId },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { checkedIn: "desc" },
    });

    // Also get registered athletes who haven't been marked yet
    const registeredAthletes = await db.instanceRegistration.findMany({
      where: {
        programInstanceId: instanceId,
        status: { in: ["REGISTERED", "ATTENDED"] },
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Combine: all registered athletes with their attendance status
    const attendedIds = new Set(attendances.map(a => a.athleteId));
    const allAthletes = registeredAthletes.map(reg => ({
      athlete: reg.athlete,
      registration: {
        id: reg.id,
        status: reg.status,
      },
      attendance: attendances.find(a => a.athleteId === reg.athleteId) || null,
    }));

    return NextResponse.json({
      attendances,
      roster: allAthletes,
      summary: {
        total: registeredAthletes.length,
        checkedIn: attendances.filter(a => a.checkedIn).length,
        absent: attendances.filter(a => a.status === "ABSENT").length,
        pending: registeredAthletes.length - attendedIds.size,
      },
    });
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return NextResponse.json(
      { error: "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

// POST /api/programs/[id]/instances/[instanceId]/attendance
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("attendance.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId, instanceId } = await params;
    const body = await request.json();

    // Verify instance exists and belongs to organization
    const instance = await db.programInstance.findFirst({
      where: {
        id: instanceId,
        programId,
        organizationId: session.user.organizationId,
      },
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    // Check if bulk or single attendance
    if (body.attendances) {
      const validated = bulkAttendanceSchema.parse(body);

      // Upsert attendance records
      const results = await Promise.all(
        validated.attendances.map(async (att) => {
          const checkedInTime = getCheckedInTime(att.checkedIn);
          return db.instanceAttendance.upsert({
            where: {
              programInstanceId_athleteId: {
                programInstanceId: instanceId,
                athleteId: att.athleteId,
              },
            },
            create: {
              programInstanceId: instanceId,
              athleteId: att.athleteId,
              status: att.status,
              checkedIn: checkedInTime,
              notes: att.notes,
            },
            update: {
              status: att.status,
              checkedIn: checkedInTime,
              notes: att.notes,
            },
          });
        })
      );

      // Also update related registration statuses if applicable
      // Mark as ATTENDED for those who are present
      await db.instanceRegistration.updateMany({
        where: {
          programInstanceId: instanceId,
          athleteId: {
            in: validated.attendances
              .filter(a => a.status === "PRESENT")
              .map(a => a.athleteId),
          },
        },
        data: { status: "ATTENDED" },
      });

      // Mark as NO_SHOW for those who are absent
      await db.instanceRegistration.updateMany({
        where: {
          programInstanceId: instanceId,
          athleteId: {
            in: validated.attendances
              .filter(a => a.status === "ABSENT")
              .map(a => a.athleteId),
          },
        },
        data: { status: "NO_SHOW" },
      });

      return NextResponse.json({
        message: `Updated ${results.length} attendance records`,
        count: results.length,
      }, { status: 201 });
    } else {
      const validated = createAttendanceSchema.parse(body);
      const checkedInTime = getCheckedInTime(validated.checkedIn);

      const attendance = await db.instanceAttendance.upsert({
        where: {
          programInstanceId_athleteId: {
            programInstanceId: instanceId,
            athleteId: validated.athleteId,
          },
        },
        create: {
          programInstanceId: instanceId,
          athleteId: validated.athleteId,
          status: validated.status,
          checkedIn: checkedInTime,
          notes: validated.notes,
        },
        update: {
          status: validated.status,
          checkedIn: checkedInTime,
          notes: validated.notes,
        },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      });

      // Update registration status if applicable
      // Map attendance status to registration status
      if (validated.status === "PRESENT") {
        await db.instanceRegistration.updateMany({
          where: {
            programInstanceId: instanceId,
            athleteId: validated.athleteId,
          },
          data: { status: "ATTENDED" },
        });
      } else if (validated.status === "ABSENT") {
        await db.instanceRegistration.updateMany({
          where: {
            programInstanceId: instanceId,
            athleteId: validated.athleteId,
          },
          data: { status: "NO_SHOW" },
        });
      }

      return NextResponse.json(attendance, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating attendance:", error);
    return NextResponse.json(
      { error: "Failed to create attendance" },
      { status: 500 }
    );
  }
}
