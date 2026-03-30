import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSubscriptionSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
});

// GET /api/organization/subscription - Get current organization's subscription
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await db.organizationSubscription.findUnique({
      where: { organizationId: session.user.organizationId },
      include: {
        plan: true,
        organization: {
          select: {
            _count: {
              select: { organizationAthletes: true, members: true, events: true },
            },
          },
        },
      },
    });

    // Also get available plans
    const availablePlans = await db.subscriptionPlan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json({
      subscription,
      availablePlans,
      usage: subscription?.organization._count,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

// PATCH /api/organization/subscription - Change plan (if not locked)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission - only admins can change subscription
    if (
      !session.user.permissions?.includes("*") &&
      !session.user.permissions?.includes("settings.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateSubscriptionSchema.parse(body);

    // Get current subscription
    const currentSubscription = await db.organizationSubscription.findUnique({
      where: { organizationId: session.user.organizationId },
    });

    if (!currentSubscription) {
      return NextResponse.json(
        { error: "No subscription found. Please contact support." },
        { status: 404 }
      );
    }

    // Check if subscription is locked
    if (currentSubscription.isLocked) {
      return NextResponse.json(
        {
          error: "Your subscription is locked and cannot be changed.",
          reason: currentSubscription.lockedReason || "Contact support for assistance.",
        },
        { status: 403 }
      );
    }

    // Verify the new plan exists and is available
    const newPlan = await db.subscriptionPlan.findUnique({
      where: { id: validatedData.planId },
    });

    if (!newPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!newPlan.isActive || !newPlan.isPublic) {
      return NextResponse.json(
        { error: "This plan is not available for selection" },
        { status: 400 }
      );
    }

    // Check if org exceeds new plan limits
    const orgCounts = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        _count: {
          select: { organizationAthletes: true, members: true, events: true },
        },
      },
    });

    if (orgCounts) {
      const { organizationAthletes: athletes, members, events } = orgCounts._count;

      if (newPlan.maxAthletes && athletes > newPlan.maxAthletes) {
        return NextResponse.json(
          {
            error: `This plan only allows ${newPlan.maxAthletes} athletes. You currently have ${athletes}.`,
          },
          { status: 400 }
        );
      }

      if (newPlan.maxUsers && members > newPlan.maxUsers) {
        return NextResponse.json(
          {
            error: `This plan only allows ${newPlan.maxUsers} users. You currently have ${members}.`,
          },
          { status: 400 }
        );
      }

      if (newPlan.maxEvents && events > newPlan.maxEvents) {
        return NextResponse.json(
          {
            error: `This plan only allows ${newPlan.maxEvents} events. You currently have ${events}.`,
          },
          { status: 400 }
        );
      }
    }

    // Calculate new billing period if cycle is changing
    const now = new Date();
    let periodEnd = currentSubscription.currentPeriodEnd;

    if (
      validatedData.billingCycle &&
      validatedData.billingCycle !== currentSubscription.billingCycle
    ) {
      periodEnd = new Date(now);
      if (validatedData.billingCycle === "YEARLY") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }

    // Update subscription
    const subscription = await db.organizationSubscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: validatedData.planId,
        billingCycle: validatedData.billingCycle || currentSubscription.billingCycle,
        currentPeriodStart:
          validatedData.billingCycle !== currentSubscription.billingCycle
            ? now
            : currentSubscription.currentPeriodStart,
        currentPeriodEnd: periodEnd,
      },
      include: {
        plan: true,
      },
    });

    return NextResponse.json(subscription);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating subscription:", error);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
