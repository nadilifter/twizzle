import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const programSchema = z.object({
  programId: z.string().min(1, "Program ID is required"),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
          select: {
            id: true,
            name: true,
            status: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
          },
        },
      },
    });

    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    return NextResponse.json(pass.coveredPrograms);
  } catch (error) {
    console.error("Error fetching pass programs:", error);
    return NextResponse.json({ error: "Failed to fetch pass programs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const { programId } = programSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const pass = await scopedDb.pass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const program = await db.program.findFirst({
      where: { id: programId, organizationId: session.user.organizationId },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const updated = await scopedDb.pass.update({
      where: { id },
      data: {
        coveredPrograms: { connect: { id: programId } },
      },
      include: {
        coveredPrograms: {
          select: {
            id: true,
            name: true,
            status: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
          },
        },
      },
    });

    return NextResponse.json(updated.coveredPrograms, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding program to pass:", error);
    return NextResponse.json({ error: "Failed to add program to pass" }, { status: 500 });
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
    const { programId } = programSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const pass = await scopedDb.pass.findUnique({ where: { id } });
    if (!pass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    await scopedDb.pass.update({
      where: { id },
      data: {
        coveredPrograms: { disconnect: { id: programId } },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error removing program from pass:", error);
    return NextResponse.json({ error: "Failed to remove program from pass" }, { status: 500 });
  }
}
