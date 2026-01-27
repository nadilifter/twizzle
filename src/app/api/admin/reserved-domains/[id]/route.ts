import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

// DELETE - Remove a reserved domain
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if the reserved domain exists
    const existing = await db.reservedDomain.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: "Reserved domain not found" }, { status: 404 });
    }

    await db.reservedDomain.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reserved domain:", error);
    return NextResponse.json({ error: "Failed to delete reserved domain" }, { status: 500 });
  }
}

// GET - Get a single reserved domain
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const reservedDomain = await db.reservedDomain.findUnique({
      where: { id }
    });

    if (!reservedDomain) {
      return NextResponse.json({ error: "Reserved domain not found" }, { status: 404 });
    }

    return NextResponse.json(reservedDomain);
  } catch (error) {
    console.error("Error fetching reserved domain:", error);
    return NextResponse.json({ error: "Failed to fetch reserved domain" }, { status: 500 });
  }
}
