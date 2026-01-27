import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createTierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  interval: z.enum(["MONTHLY", "YEARLY", "SESSION"]).default("MONTHLY"),
});

// POST /api/programs/[id]/tiers
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = createTierSchema.parse(body);

    const program = await db.program.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const tier = await db.membershipTier.create({
      data: {
        programId: id,
        organizationId: session.user.organizationId,
        name: validatedData.name,
        price: validatedData.price,
        interval: validatedData.interval,
      },
    });

    return NextResponse.json(tier);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating membership tier:", error);
    return NextResponse.json(
      { error: "Failed to create membership option" },
      { status: 500 }
    );
  }
}
