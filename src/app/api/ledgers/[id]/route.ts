import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateGLCodeSchema = z.object({
  code: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: z.enum(["REVENUE", "EXPENSE", "LIABILITY", "ASSET", "EQUITY"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const organizationId = session.user.organizationId;

    const glCode = await db.gLCode.findFirst({
      where: { id, organizationId },
      include: {
        programs: {
          select: { id: true, name: true, status: true, basePrice: true },
          orderBy: { name: "asc" },
        },
        events: {
          select: { id: true, title: true, date: true, type: true },
          orderBy: { date: "desc" },
          take: 50,
        },
        competitions: {
          select: { id: true, name: true, status: true, startDate: true },
          orderBy: { startDate: "desc" },
        },
        products: {
          select: { id: true, name: true, price: true, isActive: true },
          orderBy: { name: "asc" },
        },
        membershipGroups: {
          select: { id: true, name: true, defaultPrice: true },
          orderBy: { name: "asc" },
        },
        passes: {
          select: { id: true, name: true, price: true, status: true },
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            programs: true,
            events: true,
            competitions: true,
            products: true,
            membershipGroups: true,
            passes: true,
            lineItems: true,
            ledgerEntries: true,
          },
        },
      },
    });

    if (!glCode) {
      return NextResponse.json({ error: "GL code not found" }, { status: 404 });
    }

    // Get LineItem aggregate for this GL code
    const lineItemStats = await db.lineItem.aggregate({
      where: { glCodeId: id, invoice: { organizationId } },
      _sum: { total: true },
      _count: true,
    });

    return NextResponse.json({
      ...glCode,
      totalAmount: Number(lineItemStats._sum.total || 0),
      transactionCount: lineItemStats._count,
    });
  } catch (error) {
    console.error("Error fetching GL code:", error);
    return NextResponse.json({ error: "Failed to fetch GL code" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("financials.write")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const organizationId = session.user.organizationId;
    const body = await request.json();
    const validatedData = updateGLCodeSchema.parse(body);

    // If code is being changed, check for duplicates
    if (validatedData.code) {
      const existing = await db.gLCode.findFirst({
        where: { code: validatedData.code, organizationId, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A GL code with this code already exists" },
          { status: 409 }
        );
      }
    }

    const glCode = await db.gLCode.update({
      where: { id, organizationId },
      data: validatedData,
    });

    return NextResponse.json(glCode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating GL code:", error);
    return NextResponse.json({ error: "Failed to update GL code" }, { status: 500 });
  }
}

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
      !session.user.permissions.includes("financials.delete")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const organizationId = session.user.organizationId;

    const glCode = await db.gLCode.findFirst({
      where: { id, organizationId },
      select: { isDefault: true },
    });

    if (!glCode) {
      return NextResponse.json({ error: "GL code not found" }, { status: 404 });
    }

    if (glCode.isDefault) {
      return NextResponse.json(
        { error: "Cannot delete a default GL code. You can deactivate it instead." },
        { status: 400 }
      );
    }

    const hasEntries = await db.ledgerEntry.count({
      where: { glCodeId: id, organizationId },
    });

    if (hasEntries > 0) {
      return NextResponse.json(
        { error: "Cannot delete GL code with existing entries. Mark it as inactive instead." },
        { status: 400 }
      );
    }

    await db.gLCode.delete({ where: { id, organizationId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting GL code:", error);
    return NextResponse.json({ error: "Failed to delete GL code" }, { status: 500 });
  }
}
