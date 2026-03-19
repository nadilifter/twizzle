import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await db.accountingConnection.findUnique({
      where: {
        organizationId_provider: {
          organizationId: session.user.organizationId,
          provider: "XERO",
        },
      },
      include: { accountMappings: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No Xero connection found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ mappings: connection.accountMappings });
  } catch (error) {
    console.error("[Xero Mappings GET] Error:", error);
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
  externalAccountId: z.string().min(1),
  externalAccountName: z.string().min(1),
});

const saveMappingsSchema = z.object({
  mappings: z.array(mappingItemSchema).min(1),
});

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

    const connection = await db.accountingConnection.findUnique({
      where: {
        organizationId_provider: {
          organizationId: session.user.organizationId,
          provider: "XERO",
        },
      },
    });

    if (!connection || !connection.isActive) {
      return NextResponse.json(
        { error: "No active Xero connection" },
        { status: 404 }
      );
    }

    await db.$transaction(async (tx) => {
      await tx.accountingAccountMapping.deleteMany({
        where: { connectionId: connection.id },
      });

      await tx.accountingAccountMapping.createMany({
        data: parsed.data.mappings.map((m) => ({
          connectionId: connection.id,
          mappingType: m.mappingType,
          uplifterEntityId: m.uplifterEntityId ?? null,
          externalAccountId: m.externalAccountId,
          externalAccountName: m.externalAccountName,
        })),
      });

      await tx.accountingConnection.update({
        where: { id: connection.id },
        data: { setupComplete: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Xero Mappings PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to save mappings" },
      { status: 500 }
    );
  }
}
