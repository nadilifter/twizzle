import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateMemberCertificationSchema = z.object({
  passed: z.boolean().optional(),
  score: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  grantedAt: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id, memberId } = await params;

    const certification = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const existing = await db.memberCertification.findUnique({
      where: {
        certificationId_memberId: {
          certificationId: id,
          memberId,
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member certification not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateMemberCertificationSchema.parse(body);

    const grantedAt = validatedData.grantedAt
      ? new Date(validatedData.grantedAt)
      : existing.grantedAt;

    const passed = validatedData.passed ?? existing.passed;

    let expiresAt: Date | null = null;
    if (certification.renewalPeriodMonths && passed) {
      expiresAt = new Date(grantedAt);
      expiresAt.setMonth(expiresAt.getMonth() + certification.renewalPeriodMonths);
    }

    const memberCertification = await db.memberCertification.update({
      where: {
        certificationId_memberId: {
          certificationId: id,
          memberId,
        },
      },
      data: {
        passed,
        score: validatedData.score !== undefined ? validatedData.score : existing.score,
        notes: validatedData.notes !== undefined ? validatedData.notes : existing.notes,
        grantedAt,
        expiresAt,
      },
      include: {
        member: {
          select: {
            id: true,
            title: true,
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        grantedBy: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json(memberCertification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating member certification:", error);
    return NextResponse.json({ error: "Failed to update member certification" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { id, memberId } = await params;

    const certification = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const existing = await db.memberCertification.findUnique({
      where: {
        certificationId_memberId: {
          certificationId: id,
          memberId,
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member certification not found" }, { status: 404 });
    }

    await db.memberCertification.delete({
      where: {
        certificationId_memberId: {
          certificationId: id,
          memberId,
        },
      },
    });

    return NextResponse.json({ message: "Certification revoked" });
  } catch (error) {
    console.error("Error revoking certification:", error);
    return NextResponse.json({ error: "Failed to revoke certification" }, { status: 500 });
  }
}
