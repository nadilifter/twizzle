import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateFamilySchema = z.object({
  name: z.string().min(1).optional(),
  primaryContact: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  address: z.string().optional(),
});

// GET /api/families/[id]
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
    const family = await db.family.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      include: {
        athletes: {
          include: {
            enrollments: {
              include: {
                program: true,
              },
            },
          },
        },
        paymentMethods: true,
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            lineItems: true,
          },
        },
      },
    });

    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    return NextResponse.json(family);
  } catch (error) {
    console.error("Error fetching family:", error);
    return NextResponse.json(
      { error: "Failed to fetch family" },
      { status: 500 }
    );
  }
}

// PATCH /api/families/[id]
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
      !session.user.permissions.includes("families.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateFamilySchema.parse(body);

    const existing = await db.family.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    const family = await db.family.update({
      where: { id },
      data: validatedData,
      include: {
        athletes: true,
      },
    });

    return NextResponse.json(family);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
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

// DELETE /api/families/[id]
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
      !session.user.permissions.includes("families.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.family.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    await db.family.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return NextResponse.json(
      { error: "Failed to delete family" },
      { status: 500 }
    );
  }
}
