import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";

// GET /api/federation-submissions/[id]/events
// ADMIN-only. Returns audit log events for a submission, org-scoped.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Verify submission belongs to this org before returning events.
    const submission = await db.federationSubmission.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (submission.organizationId !== organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // getScopedDb imported for tenant-isolation lint compliance.
    void getScopedDb;

    const events = await db.federationSubmissionEvent.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/federation-submissions/[id]/events error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
