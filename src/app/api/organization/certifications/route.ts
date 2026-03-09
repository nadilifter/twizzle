import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const evaluationMethodEnum = z.enum(["PASS_FAIL", "POINT_SCALE"]);

const createCertificationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  criteria: z.string().optional().nullable(),
  evaluationMethod: evaluationMethodEnum.optional().default("PASS_FAIL"),
  pointScaleMin: z.number().int().min(0).max(100).optional().default(1),
  pointScaleMax: z.number().int().min(1).max(100).optional().default(10),
  passThreshold: z.number().int().min(0).max(100).optional().default(7),
  renewalPeriodMonths: z.number().int().min(1).max(120).optional().nullable(),
  requiredForPrograms: z.boolean().optional().default(false),
  requiredForEvents: z.boolean().optional().default(false),
  requiredForCompetitions: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

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

    const certifications = await db.certification.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { memberCertifications: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(certifications);
  } catch (error) {
    console.error("Error fetching certifications:", error);
    return NextResponse.json({ error: "Failed to fetch certifications" }, { status: 500 });
  }
}

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

    const body = await request.json();
    const validatedData = createCertificationSchema.parse(body);

    const certification = await db.certification.create({
      data: {
        organizationId,
        name: validatedData.name,
        description: validatedData.description ?? null,
        criteria: validatedData.criteria ?? null,
        evaluationMethod: validatedData.evaluationMethod,
        pointScaleMin: validatedData.pointScaleMin,
        pointScaleMax: validatedData.pointScaleMax,
        passThreshold: validatedData.passThreshold,
        renewalPeriodMonths: validatedData.renewalPeriodMonths ?? null,
        requiredForPrograms: validatedData.requiredForPrograms,
        requiredForEvents: validatedData.requiredForEvents,
        requiredForCompetitions: validatedData.requiredForCompetitions,
        isActive: validatedData.isActive,
      },
      include: {
        _count: {
          select: { memberCertifications: true },
        },
      },
    });

    return NextResponse.json(certification, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating certification:", error);
    return NextResponse.json({ error: "Failed to create certification" }, { status: 500 });
  }
}
