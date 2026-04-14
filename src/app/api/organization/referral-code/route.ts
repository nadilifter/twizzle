import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateReferralCode } from "@/lib/referral";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { referralCode: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (org.referralCode) {
      return NextResponse.json({ referralCode: org.referralCode });
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateReferralCode();
      try {
        const updated = await db.organization.update({
          where: { id: organizationId },
          data: { referralCode: code },
          select: { referralCode: true },
        });
        return NextResponse.json({ referralCode: updated.referralCode });
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
        throw err;
      }
    }

    return NextResponse.json({ error: "Failed to generate unique referral code" }, { status: 500 });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
