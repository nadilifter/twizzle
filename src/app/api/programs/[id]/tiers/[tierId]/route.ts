import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE /api/programs/[id]/tiers/[tierId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; tierId: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, tierId } = await params;

    const tier = await db.membershipTier.findFirst({
      where: {
        id: tierId,
        programId: id,
        organizationId: session.user.organizationId,
      },
    });

    if (!tier) {
      return NextResponse.json({ error: "Membership option not found" }, { status: 404 });
    }

    await db.membershipTier.delete({
      where: { id: tierId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting membership tier:", error);
    return NextResponse.json(
      { error: "Failed to delete membership option" },
      { status: 500 }
    );
  }
}
