import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const addresses = await db.userBillingAddress.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("Fetch user addresses error:", error);
    return NextResponse.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { label, street, city, stateProvince, postalCode, country } = body;

    if (!street || !city || !postalCode) {
      return NextResponse.json(
        { error: "street, city, and postalCode are required" },
        { status: 400 }
      );
    }

    const existingCount = await db.userBillingAddress.count({ where: { userId: session.user.id } });

    const address = await db.userBillingAddress.create({
      data: {
        userId: session.user.id,
        label: label || null,
        street,
        city,
        stateProvince: stateProvince || null,
        postalCode,
        country: country || "US",
        isPrimary: existingCount === 0,
      },
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error("Create user address error:", error);
    return NextResponse.json({ error: "Failed to create address" }, { status: 500 });
  }
}
