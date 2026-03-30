import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const grantCertificationSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  passed: z.boolean(),
  score: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  grantedAt: z.string().optional(),
});

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

    const { id } = await params;

    const certification = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const memberCertifications = await db.memberCertification.findMany({
      where: { certificationId: id },
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
      orderBy: { grantedAt: "desc" },
    });

    return NextResponse.json(memberCertifications);
  } catch (error) {
    console.error("Error fetching member certifications:", error);
    return NextResponse.json({ error: "Failed to fetch member certifications" }, { status: 500 });
  }
}

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

    const { id } = await params;

    const certification = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = grantCertificationSchema.parse(body);

    const member = await db.organizationMember.findFirst({
      where: { id: validatedData.memberId, organizationId },
    });
    if (!member) {
      return NextResponse.json({ error: "Member not found in this organization" }, { status: 404 });
    }

    const existing = await db.memberCertification.findUnique({
      where: {
        certificationId_memberId: {
          certificationId: id,
          memberId: validatedData.memberId,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Member already has this certification. Use PUT to update." },
        { status: 409 }
      );
    }

    const grantedAt = validatedData.grantedAt ? new Date(validatedData.grantedAt) : new Date();

    let expiresAt: Date | null = null;
    if (certification.renewalPeriodMonths && validatedData.passed) {
      expiresAt = new Date(grantedAt);
      expiresAt.setMonth(expiresAt.getMonth() + certification.renewalPeriodMonths);
    }

    const grantingMember = await db.organizationMember.findFirst({
      where: { organizationId, userId: session.user.id },
    });

    const memberCertification = await db.memberCertification.create({
      data: {
        certificationId: id,
        memberId: validatedData.memberId,
        grantedById: grantingMember?.id ?? null,
        passed: validatedData.passed,
        score: validatedData.score ?? null,
        notes: validatedData.notes ?? null,
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

    return NextResponse.json(memberCertification, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error granting certification:", error);
    return NextResponse.json({ error: "Failed to grant certification" }, { status: 500 });
  }
}
