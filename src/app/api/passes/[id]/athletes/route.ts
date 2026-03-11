import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const addAthleteSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  autoRenew: z.boolean().default(false),
});

const removeAthleteSchema = z.object({
  athleteId: z.string().min(1, "Athlete ID is required"),
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
        athletePasses: {
          include: {
            athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    return NextResponse.json(pass.athletePasses);
  } catch (error) {
    console.error("Error fetching pass athletes:", error);
    return NextResponse.json({ error: "Failed to fetch pass athletes" }, { status: 500 });
  }
}

export async function POST(
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
    const validatedData = addAthleteSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const pass = await scopedDb.pass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const existing = await db.athletePass.findUnique({
      where: { passId_athleteId: { passId: id, athleteId: validatedData.athleteId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Athlete already has this pass" }, { status: 400 });
    }

    const athletePass = await db.athletePass.create({
      data: {
        passId: id,
        athleteId: validatedData.athleteId,
        startDate: parseDateOnly(validatedData.startDate)!,
        endDate: validatedData.endDate ? parseDateOnly(validatedData.endDate) : null,
        autoRenew: validatedData.autoRenew,
      },
      include: {
        athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
      },
    });

    return NextResponse.json(athletePass, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding athlete to pass:", error);
    return NextResponse.json({ error: "Failed to add athlete to pass" }, { status: 500 });
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

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { athleteId } = removeAthleteSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const pass = await scopedDb.pass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    await db.athletePass.delete({
      where: { passId_athleteId: { passId: id, athleteId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error removing athlete from pass:", error);
    return NextResponse.json({ error: "Failed to remove athlete from pass" }, { status: 500 });
  }
}
