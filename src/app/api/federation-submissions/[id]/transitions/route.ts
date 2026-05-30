import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { logFederationSubmissionEvent } from "@/lib/federation-submission-audit";
import { z } from "zod";

const transitionSchema = z.object({
  to: z.enum(["SUBMITTED", "ACCEPTED", "REJECTED"]),
  resolutionNote: z.string().optional(),
});

const VALID_TRANSITIONS: Record<string, readonly string[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["ACCEPTED", "REJECTED"],
};

// POST /api/federation-submissions/[id]/transitions
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    const body = await request.json();
    const parsed = transitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { to, resolutionNote } = parsed.data;

    const existing = await db.federationSubmission.findUnique({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const allowed = VALID_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(to)) {
      return NextResponse.json(
        { error: `Cannot transition from ${existing.status} to ${to}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = { status: to };

    if (to === "SUBMITTED") {
      updateData.submittedAt = now;
      updateData.submittedById = session.user.id;
    } else if (to === "ACCEPTED" || to === "REJECTED") {
      updateData.resolvedAt = now;
      updateData.resolvedById = session.user.id;
      if (resolutionNote !== undefined) {
        updateData.resolutionNote = resolutionNote;
      }
    }

    const previousStatus = existing.status;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.federationSubmission.update({
        where: { id, organizationId },
        data: updateData,
        include: {
          createdBy: { select: { name: true, email: true } },
          submittedBy: { select: { name: true, email: true } },
          resolvedBy: { select: { name: true, email: true } },
          _count: { select: { athletes: true } },
        },
      });

      await logFederationSubmissionEvent({
        submissionId: id,
        eventType: "STATUS_TRANSITIONED",
        data: { previousStatus, nextStatus: to },
        note: resolutionNote ?? null,
        actorId: session.user.id,
        prismaClient: tx,
      });

      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error transitioning federation submission:", error);
    return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
  }
}
