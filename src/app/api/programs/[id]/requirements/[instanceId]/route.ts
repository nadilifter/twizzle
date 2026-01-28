import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE - Remove a membership requirement from a program
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; instanceId: string }> }
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

    const { id: programId, instanceId } = await params;

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

    // Check if the membership is actually required
    const isRequired = program.requiredMemberships.some((m) => m.id === instanceId);

    if (!isRequired) {
      return NextResponse.json({ error: "Membership is not a requirement for this program" }, { status: 404 });
    }

    // Remove the requirement via disconnect
    await db.program.update({
      where: { id: programId },
      data: {
        requiredMemberships: {
          disconnect: { id: instanceId },
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing program requirement:", error);
    return NextResponse.json({ error: "Failed to remove program requirement" }, { status: 500 });
  }
}
