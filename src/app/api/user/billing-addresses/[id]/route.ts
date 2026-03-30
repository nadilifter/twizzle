import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.userBillingAddress.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const body = await request.json();
    const address = await db.userBillingAddress.update({
      where: { id: params.id },
      data: {
        label: body.label ?? existing.label,
        street: body.street ?? existing.street,
        city: body.city ?? existing.city,
        stateProvince: body.stateProvince ?? existing.stateProvince,
        postalCode: body.postalCode ?? existing.postalCode,
        country: body.country ?? existing.country,
      },
    });

    return NextResponse.json({ address });
  } catch (error) {
    console.error("Update user address error:", error);
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.userBillingAddress.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    await db.userBillingAddress.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user address error:", error);
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
