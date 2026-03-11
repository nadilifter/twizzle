import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const setRequirementsSchema = z.object({
  passIds: z.array(z.string()),
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

    const { id: programId } = await params;
    const organizationId = session.user.organizationId;

    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
      include: {
        requiredPasses: {
          select: {
            id: true,
            name: true,
            price: true,
            billingInterval: true,
            sessionLimit: true,
            limitPeriod: true,
            status: true,
          },
        },
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    return NextResponse.json(program.requiredPasses);
  } catch (error) {
    console.error("Error fetching program pass requirements:", error);
    return NextResponse.json({ error: "Failed to fetch pass requirements" }, { status: 500 });
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

    const { id: programId } = await params;
    const organizationId = session.user.organizationId;

    const program = await db.program.findFirst({
      where: { id: programId, organizationId },
    });
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const body = await request.json();
    const { passIds } = setRequirementsSchema.parse(body);

    // Verify all passes belong to this organization
    if (passIds.length > 0) {
      const validPasses = await db.pass.findMany({
        where: { id: { in: passIds }, organizationId },
        select: { id: true },
      });
      const validIds = new Set(validPasses.map((p) => p.id));
      const invalidIds = passIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json({ error: "Some passes not found" }, { status: 404 });
      }
    }

    const updatedProgram = await db.program.update({
      where: { id: programId },
      data: {
        requiredPasses: {
          set: passIds.map((id) => ({ id })),
        },
      },
      include: {
        requiredPasses: {
          select: {
            id: true,
            name: true,
            price: true,
            billingInterval: true,
            sessionLimit: true,
            limitPeriod: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(updatedProgram.requiredPasses);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error setting program pass requirements:", error);
    return NextResponse.json({ error: "Failed to set pass requirements" }, { status: 500 });
  }
}
