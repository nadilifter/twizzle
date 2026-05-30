import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const createSubmissionSchema = z.object({
  federation: z.enum(["SKATE_CANADA", "USFS", "ISU"]),
  athleteIds: z.array(z.string()).min(1),
  payload: z.unknown(),
});

// POST /api/federation-submissions
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const parsed = createSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { federation, athleteIds, payload } = parsed.data;

    // Verify all athleteIds belong to this org
    const orgAthletes = await db.organizationAthlete.findMany({
      where: { organizationId, athleteId: { in: athleteIds } },
      select: { athleteId: true },
    });
    if (orgAthletes.length !== athleteIds.length) {
      return NextResponse.json(
        { error: "Some athletes are not in your organization" },
        { status: 400 }
      );
    }

    const scopedDb = getScopedDb(organizationId);
    const submission = await scopedDb.$transaction(async (tx) => {
      const created = await tx.federationSubmission.create({
        data: {
          organizationId,
          federation,
          status: "DRAFT",
          createdById: session.user.id,
          payload: payload ?? {},
        },
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { athletes: true } },
        },
      });

      await tx.federationSubmissionAthlete.createMany({
        data: athleteIds.map((athleteId) => ({
          submissionId: created.id,
          athleteId,
        })),
      });

      return created;
    });

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Error creating federation submission:", error);
    return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
  }
}
