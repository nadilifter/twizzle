import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

// GET - fetch current account mappings
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.qboConnection.findUnique({
      where: { organizationId: session.user.organizationId },
      include: { accountMappings: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No QBO connection found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ mappings: connection.accountMappings });
  } catch (error) {
    console.error("[QBO Mappings GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch mappings" },
      { status: 500 }
    );
  }
}

const mappingItemSchema = z.object({
  mappingType: z.enum([
    "GL_CODE",
    "BANK_ACCOUNT",
    "PROCESSING_FEES",
    "REFUNDS",
    "UNDEPOSITED_FUNDS",
  ]),
  uplifterEntityId: z.string().nullable().optional(),
  qboAccountId: z.string().min(1),
  qboAccountName: z.string().min(1),
});

const saveMappingsSchema = z.object({
  mappings: z.array(mappingItemSchema).min(1),
});

// PUT - save/update account mappings
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = saveMappingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const connection = await db.qboConnection.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active QBO connection" },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      // Clear existing mappings for this connection
      await tx.qboAccountMapping.deleteMany({
        where: { connectionId: connection.id },
      });

      // Insert new mappings
      await tx.qboAccountMapping.createMany({
        data: parsed.data.mappings.map((m) => ({
          connectionId: connection.id,
          mappingType: m.mappingType,
          uplifterEntityId: m.uplifterEntityId ?? null,
          qboAccountId: m.qboAccountId,
          qboAccountName: m.qboAccountName,
        })),
      });

      // Mark setup as complete
      await tx.qboConnection.update({
        where: { id: connection.id },
        data: { setupComplete: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[QBO Mappings PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to save mappings" },
      { status: 500 }
    );
  }
}
