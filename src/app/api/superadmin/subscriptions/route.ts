import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSubscriptionSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  planId: z.string().min(1, "Plan ID is required"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  isLocked: z.boolean().optional(),
  lockedReason: z.string().optional(),
  trialEndsAt: z.string().datetime().optional(),
});

// GET /api/superadmin/subscriptions - List all subscriptions
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const planId = searchParams.get("planId");

    const subscriptions = await db.organizationSubscription.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(planId && { planId }),
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, slug: true, monthlyPrice: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
  }
}

// POST /api/superadmin/subscriptions - Create a subscription for an organization
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSubscriptionSchema.parse(body);

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: validatedData.organizationId },
      include: { subscription: true },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (organization.subscription) {
      return NextResponse.json(
        { error: "Organization already has a subscription. Use PATCH to update." },
        { status: 400 }
      );
    }

    // Check if plan exists
    const plan = await db.subscriptionPlan.findUnique({
      where: { id: validatedData.planId },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Calculate billing period
    const now = new Date();
    const periodEnd = new Date(now);
    if (validatedData.billingCycle === "YEARLY") {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subscription = await db.organizationSubscription.create({
      data: {
        organizationId: validatedData.organizationId,
        planId: validatedData.planId,
        billingCycle: validatedData.billingCycle || "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: validatedData.trialEndsAt ? "TRIALING" : "ACTIVE",
        isLocked: validatedData.isLocked ?? false,
        lockedReason: validatedData.lockedReason,
        lockedBy: validatedData.isLocked ? session.user.id : null,
        lockedAt: validatedData.isLocked ? now : null,
        trialEndsAt: validatedData.trialEndsAt ? new Date(validatedData.trialEndsAt) : null,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
