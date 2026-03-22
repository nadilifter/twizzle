import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { isValidPhoneNumber } from "libphonenumber-js";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const contacts = await db.userContact.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Fetch user contacts error:", error);
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, relationship } = body;

    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json({ error: "firstName, lastName, email, and phone are required" }, { status: 400 });
    }

    if (phone && !isValidPhoneNumber(phone)) {
      return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
    }

    const existingCount = await db.userContact.count({ where: { userId: session.user.id } });

    const contact = await db.userContact.create({
      data: {
        userId: session.user.id,
        firstName,
        lastName,
        email,
        phone,
        relationship: relationship || null,
        isPrimary: existingCount === 0,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("Create user contact error:", error);
    return NextResponse.json({ error: "Failed to create contact" }, { status: 500 });
  }
}
