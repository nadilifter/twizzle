import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// GET /api/federation-submissions
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const federation = searchParams.get("federation");

    const where = {
      organizationId,
      ...(status && { status: status as "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED" }),
      ...(federation && {
        federation: federation as "SKATE_CANADA" | "USFS" | "ISU",
      }),
    };

    const submissions = await db.federationSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { athletes: true } },
      },
    });

    return NextResponse.json({ data: submissions });
  } catch (error) {
    console.error("Error fetching federation submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
