import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrganizationFeatures } from "@/lib/feature-resolver";
import { parseFeatureToggles, FEATURE_KEYS, LEGACY_KEY_MAP } from "@/lib/feature-toggles";
import { z } from "zod";

const featureOverrideSchema = z.object({
  featureToggles: z.record(z.string(), z.boolean()),
});

/**
 * GET /api/superadmin/organizations/[id]/features
 * Returns the plan defaults, overrides, and resolved features for an organization.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the org's subscription with plan and any existing overrides
    const [subscription, override] = await Promise.all([
      db.organizationSubscription.findUnique({
        where: { organizationId: id },
        include: {
          plan: {
            select: { id: true, name: true, featureToggles: true },
          },
        },
      }),
      db.organizationFeatureOverride.findUnique({
        where: { organizationId: id },
        select: { featureToggles: true, updatedBy: true, updatedAt: true },
      }),
    ]);

    const planToggles = subscription?.plan?.featureToggles
      ? parseFeatureToggles(subscription.plan.featureToggles)
      : null;

    const resolved = await getOrganizationFeatures(id);

    return NextResponse.json({
      plan: subscription?.plan
        ? { id: subscription.plan.id, name: subscription.plan.name }
        : null,
      planDefaults: planToggles,
      overrides: override?.featureToggles ?? null,
      resolved,
      lastUpdatedBy: override?.updatedBy ?? null,
      lastUpdatedAt: override?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("Error fetching org features:", error);
    return NextResponse.json(
      { error: "Failed to fetch features" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/superadmin/organizations/[id]/features
 * Set feature overrides for an organization.
 * Send only the keys you want to override; send empty object to clear all overrides.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Use safeParse to avoid relying on instanceof checks in the catch block
    const parsed = featureOverrideSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Feature override validation failed:", parsed.error.issues);
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request body" },
        { status: 400 }
      );
    }

    const { featureToggles: rawToggles } = parsed.data;

    // Remap legacy keys and validate
    const featureToggles: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(rawToggles)) {
      const remappedKey = LEGACY_KEY_MAP[key] || key;
      if (!FEATURE_KEYS.includes(remappedKey as any)) {
        return NextResponse.json(
          { error: `Invalid feature key: ${key}` },
          { status: 400 }
        );
      }
      featureToggles[remappedKey] = value;
    }

    // If empty object, delete the override record
    if (Object.keys(featureToggles).length === 0) {
      await db.organizationFeatureOverride.deleteMany({
        where: { organizationId: id },
      });
    } else {
      await db.organizationFeatureOverride.upsert({
        where: { organizationId: id },
        create: {
          organizationId: id,
          featureToggles,
          updatedBy: session.user.id,
        },
        update: {
          featureToggles,
          updatedBy: session.user.id,
        },
      });
    }

    const resolved = await getOrganizationFeatures(id);
    return NextResponse.json({ resolved });
  } catch (error: any) {
    console.error("Error updating org features:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update features" },
      { status: 500 }
    );
  }
}
