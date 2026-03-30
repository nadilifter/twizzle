import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const paymentMethods = await db.paymentMethod.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        type: true,
        brand: true,
        last4: true,
        expiry: true,
        isDefault: true,
        createdAt: true,
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    console.error(
      "Fetch user payment methods error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}
