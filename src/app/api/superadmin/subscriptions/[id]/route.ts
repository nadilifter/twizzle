import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSubscriptionSchema = z.object({
  planId: z.string().optional(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  status: z.enum(["ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED", "PAUSED"]).optional(),
  isLocked: z.boolean().optional(),
  lockedReason: z.string().optional().nullable(),
  trialEndsAt: z.string().datetime().optional().nullable(),
  cancelAtPeriodEnd: z.boolean().optional(),
});

// GET /api/superadmin/subscriptions/[id] - Get a specific subscription
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // id can be subscription ID or organization ID
    const subscription = await db.organizationSubscription.findFirst({
      where: {
        OR: [{ id }, { organizationId: id }],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: {
              select: { organizationAthletes: true, members: true, events: true },
            },
          },
        },
        plan: true,
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}

// PATCH /api/superadmin/subscriptions/[id] - Update a subscription
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateSubscriptionSchema.parse(body);

    // Find subscription (by ID or org ID)
    const existingSubscription = await db.organizationSubscription.findFirst({
      where: {
        OR: [{ id }, { organizationId: id }],
      },
    });

    if (!existingSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // If changing plan, verify the new plan exists
    if (validatedData.planId) {
      const plan = await db.subscriptionPlan.findUnique({
        where: { id: validatedData.planId },
      });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.planId !== undefined) updateData.planId = validatedData.planId;
    if (validatedData.billingCycle !== undefined)
      updateData.billingCycle = validatedData.billingCycle;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;
    if (validatedData.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = validatedData.cancelAtPeriodEnd;
      if (validatedData.cancelAtPeriodEnd) {
        updateData.cancelledAt = new Date();
      }
    }
    if (validatedData.trialEndsAt !== undefined) {
      updateData.trialEndsAt = validatedData.trialEndsAt
        ? new Date(validatedData.trialEndsAt)
        : null;
    }

    // Handle lock changes
    if (validatedData.isLocked !== undefined) {
      updateData.isLocked = validatedData.isLocked;
      if (validatedData.isLocked) {
        updateData.lockedBy = session.user.id;
        updateData.lockedAt = new Date();
        updateData.lockedReason = validatedData.lockedReason || null;
      } else {
        updateData.lockedBy = null;
        updateData.lockedAt = null;
        updateData.lockedReason = null;
      }
    } else if (validatedData.lockedReason !== undefined) {
      updateData.lockedReason = validatedData.lockedReason;
    }

    const subscription = await db.organizationSubscription.update({
      where: { id: existingSubscription.id },
      data: updateData,
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        plan: {
          select: { id: true, name: true, slug: true },
        },
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

// DELETE /api/superadmin/subscriptions/[id] - Delete a subscription
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find subscription (by ID or org ID)
    const subscription = await db.organizationSubscription.findFirst({
      where: {
        OR: [{ id }, { organizationId: id }],
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    await db.organizationSubscription.delete({
      where: { id: subscription.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json({ error: "Failed to delete subscription" }, { status: 500 });
  }
}
