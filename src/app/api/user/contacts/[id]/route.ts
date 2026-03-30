import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { isValidPhoneNumber } from "libphonenumber-js";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.userContact.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.phone && !isValidPhoneNumber(body.phone)) {
      return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
    }

    const contact = await db.userContact.update({
      where: { id: params.id },
      data: {
        firstName: body.firstName ?? existing.firstName,
        lastName: body.lastName ?? existing.lastName,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        relationship: body.relationship ?? existing.relationship,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error("Update user contact error:", error);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const existing = await db.userContact.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await db.userContact.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user contact error:", error);
    return NextResponse.json({ error: "Failed to delete contact" }, { status: 500 });
  }
}
