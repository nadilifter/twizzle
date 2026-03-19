import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const evaluationMethodEnum = z.enum(["PASS_FAIL", "POINT_SCALE"]);

const updateCertificationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  criteria: z.string().optional().nullable(),
  evaluationMethod: evaluationMethodEnum.optional(),
  pointScaleMin: z.number().int().min(0).max(100).optional(),
  pointScaleMax: z.number().int().min(1).max(100).optional(),
  passThreshold: z.number().int().min(0).max(100).optional(),
  renewalPeriodMonths: z.number().int().min(1).max(120).optional().nullable(),
  requiredForPrograms: z.boolean().optional(),
  requiredForEvents: z.boolean().optional(),
  requiredForCompetitions: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const certification = await db.certification.findFirst({
      where: { id, organizationId },
      include: {
        memberCertifications: {
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
        },
        _count: {
          select: { memberCertifications: true },
        },
      },
    });

    if (!certification) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    return NextResponse.json(certification);
  } catch (error) {
    console.error("Error fetching certification:", error);
    return NextResponse.json({ error: "Failed to fetch certification" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const existing = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateCertificationSchema.parse(body);

    const certification = await db.certification.update({
      where: { id, organizationId },
      data: validatedData,
      include: {
        _count: {
          select: { memberCertifications: true },
        },
      },
    });

    return NextResponse.json(certification);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating certification:", error);
    return NextResponse.json({ error: "Failed to update certification" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const existing = await db.certification.findFirst({
      where: { id, organizationId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Certification not found" }, { status: 404 });
    }

    await db.certification.delete({ where: { id, organizationId } });

    return NextResponse.json({ message: "Certification deleted" });
  } catch (error) {
    console.error("Error deleting certification:", error);
    return NextResponse.json({ error: "Failed to delete certification" }, { status: 500 });
  }
}
