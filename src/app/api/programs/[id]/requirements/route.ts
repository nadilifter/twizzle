import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const addRequirementSchema = z.object({
  membershipInstanceId: z.string().min(1, "Membership instance is required"),
});

// GET - Get program requirements (required memberships)
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
      include: {
        requiredMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(program.requiredMemberships);
  } catch (error) {
    console.error("Error fetching program requirements:", error);
    return NextResponse.json({ error: "Failed to fetch program requirements" }, { status: 500 });
  }
}

// POST - Add a membership requirement to a program
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
      include: {
        requiredMemberships: true,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = addRequirementSchema.parse(body);

    // Verify membership instance belongs to organization
    const membershipInstance = await db.membershipInstance.findFirst({
      where: {
        id: validatedData.membershipInstanceId,
        group: {
          organizationId,
        },
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membershipInstance) {
      return NextResponse.json({ error: "Membership instance not found" }, { status: 404 });
    }

    // Check if already added
    const alreadyRequired = program.requiredMemberships.some(
      (m) => m.id === validatedData.membershipInstanceId
    );

    if (alreadyRequired) {
      return NextResponse.json({ error: "Membership is already required for this program" }, { status: 400 });
    }

    // Add the requirement via connect
    const updatedProgram = await db.program.update({
      where: { id: programId },
      data: {
        requiredMemberships: {
          connect: { id: validatedData.membershipInstanceId },
        },
      },
      include: {
        requiredMemberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedProgram.requiredMemberships, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding program requirement:", error);
    return NextResponse.json({ error: "Failed to add program requirement" }, { status: 500 });
  }
}
