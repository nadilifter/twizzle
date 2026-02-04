import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateProgramSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  level: z.string().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
});

// GET /api/programs/[id]
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
    const program = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        membershipTiers: true,
        staffAssignments: {
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
            { isPrimary: "desc" },
            { role: "asc" },
          ],
        },
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
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                level: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { date: "desc" },
          take: 10,
        },
        lessonPlans: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        lineItems: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            invoice: {
              select: {
                id: true,
                reference: true,
                status: true,
                family: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(program);
  } catch (error) {
    console.error("Error fetching program:", error);
    return NextResponse.json(
      { error: "Failed to fetch program" },
      { status: 500 }
    );
  }
}

// PATCH /api/programs/[id]
export async function PATCH(
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
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateProgramSchema.parse(body);

    const existing = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const program = await db.program.update({
      where: { id },
      data: validatedData,
      include: {
        membershipTiers: true,
        staffAssignments: {
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
        },
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
        _count: {
          select: {
            enrollments: true,
            events: true,
            lessonPlans: true,
          },
        },
      },
    });

    return NextResponse.json(program);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating program:", error);
    return NextResponse.json(
      { error: "Failed to update program" },
      { status: 500 }
    );
  }
}

// DELETE /api/programs/[id]
export async function DELETE(
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
      !session.user.permissions.includes("training.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    // Check if there are active enrollments
    if (existing._count.enrollments > 0) {
      return NextResponse.json(
        { error: "Cannot delete program with active enrollments. Archive it instead." },
        { status: 400 }
      );
    }

    await db.program.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting program:", error);
    return NextResponse.json(
      { error: "Failed to delete program" },
      { status: 500 }
    );
  }
}
