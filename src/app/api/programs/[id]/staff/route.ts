import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addProgramStaffSchema = z.object({
  staffProfileId: z.string().min(1, "Staff profile is required"),
  role: z.enum(["LEAD_COACH", "ASSISTANT_COACH", "SUBSTITUTE", "VOLUNTEER"]).optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// GET - List all staff assigned to a program
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

    const { id: programId } = await params;

    // Verify program exists in organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const programStaff = await db.programStaff.findMany({
      where: { programId },
      include: {
        staffProfile: {
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
        { isPrimary: "desc" }, // Primary first
        { role: "asc" }, // LEAD_COACH first
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json(programStaff);
  } catch (error) {
    console.error("Error fetching program staff:", error);
    return NextResponse.json({ error: "Failed to fetch program staff" }, { status: 500 });
  }
}

// POST - Add staff to a program
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
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: programId } = await params;

    // Verify program exists in organization
    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = addProgramStaffSchema.parse(body);

    // Verify staff profile belongs to organization
    const staffProfile = await db.staffProfile.findFirst({
      where: { id: validatedData.staffProfileId, organizationId },
    });

    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    // Check if staff is already assigned to program
    const existingAssignment = await db.programStaff.findUnique({
      where: {
        programId_staffProfileId: {
          programId,
          staffProfileId: validatedData.staffProfileId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json({ error: "Staff member is already assigned to this program" }, { status: 400 });
    }

    // If setting as primary, remove primary from others
    if (validatedData.isPrimary) {
      await db.programStaff.updateMany({
        where: { programId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const programStaff = await db.programStaff.create({
      data: {
        programId,
        staffProfileId: validatedData.staffProfileId,
        role: validatedData.role || "ASSISTANT_COACH",
        isPrimary: validatedData.isPrimary ?? false,
        notes: validatedData.notes ?? null,
      },
      include: {
        staffProfile: {
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

    return NextResponse.json(programStaff, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding program staff:", error);
    return NextResponse.json({ error: "Failed to add program staff" }, { status: 500 });
  }
}
