import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const updateMembershipGroupSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional(),
  programTypes: z.array(z.string()).optional(),
  allowAutoRenew: z.boolean().optional(),
});

// GET /api/memberships/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    const group = await scopedDb.membershipGroup.findUnique({
      where: {
        id: params.id,
      },
      include: {
        instances: {
            orderBy: { startDate: 'desc' },
            take: 5
        },
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error fetching membership group:", error);
    return NextResponse.json(
      { error: "Failed to fetch membership group" },
      { status: 500 }
    );
  }
}

// PATCH /api/memberships/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const body = await request.json();
    const validatedData = updateMembershipGroupSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const updatedGroup = await scopedDb.membershipGroup.update({
      where: { id: params.id },
      data: validatedData,
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating membership group:", error);
    return NextResponse.json(
      { error: "Failed to update membership group" },
      { status: 500 }
    );
  }
}

// DELETE /api/memberships/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);

    await scopedDb.membershipGroup.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting membership group:", error);
    return NextResponse.json(
      { error: "Failed to delete membership group" },
      { status: 500 }
    );
  }
}
