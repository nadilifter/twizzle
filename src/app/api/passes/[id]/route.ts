import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const updatePassSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().min(0).optional(),
  billingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).optional(),
  sessionLimit: z.number().int().min(1).optional(),
  limitPeriod: z.enum(["WEEKLY", "MONTHLY"]).optional(),
  coversAllPrograms: z.boolean().optional(),
  hasGenderRestriction: z.boolean().optional(),
  allowedGenders: z.array(z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])).optional(),
  programIds: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "ARCHIVED"]).optional(),
  glCodeId: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "passes");
    if (gate) return gate;

    const { id } = await params;
    const scopedDb = getScopedDb(session.user.organizationId);

    const pass = await scopedDb.pass.findUnique({
      where: { id },
      include: {
        coveredPrograms: {
          select: { id: true, name: true, status: true, basePrice: true, perSessionPrice: true, pricingModel: true },
        },
        requiredForPrograms: {
          select: { id: true, name: true, status: true },
        },
        athletePasses: {
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
          },
        },
        _count: { select: { athletePasses: true, coveredPrograms: true } },
      },
    });

    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    return NextResponse.json(pass);
  } catch (error) {
    console.error("Error fetching pass:", error);
    return NextResponse.json({ error: "Failed to fetch pass" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "passes");
    if (gate) return gate;

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePassSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const existing = await scopedDb.pass.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const { programIds, allowedGenders, ...scalarData } = validatedData;

    if (scalarData.hasGenderRestriction !== undefined) {
      (scalarData as any).allowedGenders = scalarData.hasGenderRestriction ? (allowedGenders ?? []) : [];
    }

    if (programIds && programIds.length > 0) {
      const validPrograms = await scopedDb.program.findMany({
        where: { id: { in: programIds } },
        select: { id: true },
      });
      if (validPrograms.length !== programIds.length) {
        return NextResponse.json({ error: "One or more programs not found" }, { status: 404 });
      }
    }

    if (scalarData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: scalarData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }

    const updated = await scopedDb.pass.update({
      where: { id },
      data: {
        ...scalarData,
        ...(programIds !== undefined
          ? { coveredPrograms: { set: programIds.map((pid) => ({ id: pid })) } }
          : {}),
      },
      include: {
        coveredPrograms: {
          select: { id: true, name: true, status: true, basePrice: true, perSessionPrice: true, pricingModel: true },
        },
        athletePasses: {
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
          },
        },
        _count: { select: { athletePasses: true, coveredPrograms: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating pass:", error);
    return NextResponse.json({ error: "Failed to update pass" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "passes");
    if (gate) return gate;

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("training.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    await scopedDb.pass.delete({ where: { id: (await params).id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting pass:", error);
    return NextResponse.json({ error: "Failed to delete pass" }, { status: 500 });
  }
}
