import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const configSchema = z.object({
  validityDays: z.number().int().min(1).max(3650).optional(),
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

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    const scopedDb = getScopedDb(organizationId);
    const config = await scopedDb.customInfoConfig.findUnique({
      where: { organizationId },
    });

    if (config) {
      return NextResponse.json(config);
    }

    return NextResponse.json({
      id: null,
      organizationId,
      validityDays: 365,
    });
  } catch (error) {
    console.error("Error fetching custom info config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const gate = await checkFeatureGate(organizationId, "customInformation");
    if (gate) return gate;

    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: session.user.id,
          },
        },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = configSchema.parse(body);

    const scopedDb = getScopedDb(organizationId);
    const config = await scopedDb.customInfoConfig.upsert({
      where: { organizationId },
      update: validatedData,
      create: {
        organizationId,
        ...validatedData,
      },
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating custom info config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
