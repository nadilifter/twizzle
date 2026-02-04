import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const updateFamilySchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  primaryContact: z.string().min(1, "Primary contact is required").optional(),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  address: z.string().optional().nullable(),
});

// GET /api/families/[id] - Get a single family with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: "Please select an organization first" },
        { status: 400 }
      );
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    const family = await scopedDb.family.findUnique({
      where: { id },
      include: {
        guardians: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                email: true,
                level: true,
                group: true,
                status: true,
                avatar: true,
                birthDate: true,
                enrollments: {
                  include: {
                    program: {
                      select: {
                        id: true,
                        name: true,
                        level: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        paymentMethods: true,
        invoices: {
          include: {
            lineItems: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Transform the response to match the expected type
    const transformedFamily = {
      ...family,
      athletes: family.guardians.map((g) => g.athlete),
    };

    return NextResponse.json(transformedFamily);
  } catch (error) {
    console.error("Error fetching family:", error);
    return NextResponse.json(
      { error: "Failed to fetch family" },
      { status: 500 }
    );
  }
}

// PATCH /api/families/[id] - Update a family
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: "Please select an organization first" },
        { status: 400 }
      );
    }

    // Check permissions
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("families.update")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateFamilySchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    // Check if family exists
    const existingFamily = await scopedDb.family.findUnique({
      where: { id },
    });

    if (!existingFamily) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    const updatedFamily = await scopedDb.family.update({
      where: { id },
      data: validatedData,
      include: {
        guardians: {
          include: {
            athlete: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            invoices: true,
            paymentMethods: true,
          },
        },
      },
    });

    const transformedFamily = {
      ...updatedFamily,
      athletes: updatedFamily.guardians.map((g) => g.athlete),
    };

    return NextResponse.json(transformedFamily);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating family:", error);
    return NextResponse.json(
      { error: "Failed to update family" },
      { status: 500 }
    );
  }
}

// DELETE /api/families/[id] - Delete a family
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: "Please select an organization first" },
        { status: 400 }
      );
    }

    // Check permissions
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("families.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    // Check if family exists
    const existingFamily = await scopedDb.family.findUnique({
      where: { id },
    });

    if (!existingFamily) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    await scopedDb.family.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return NextResponse.json(
      { error: "Failed to delete family" },
      { status: 500 }
    );
  }
}
