import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const featureTogglesSchema = z
  .object({
    events: z.boolean(),
    competitions: z.boolean(),
    sms: z.boolean(),
    emailCampaigns: z.boolean(),
    customDomains: z.boolean(),
    accountingIntegrations: z.boolean(),
    training: z.boolean(),
    store: z.boolean(),
    liveSupport: z.boolean(),
    customInformation: z.boolean(),
  })
  .optional();

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().optional().nullable(),
  monthlyPrice: z.number().min(0).optional(),
  yearlyPrice: z.number().min(0).optional().nullable(),
  transactionFee: z.number().min(0).max(1).optional(),
  perTransactionFee: z.number().min(0).optional(),
  maxAthletes: z.number().int().positive().optional().nullable(),
  maxUsers: z.number().int().positive().optional().nullable(),
  maxPrograms: z.number().int().positive().optional().nullable(),
  maxEvents: z.number().int().positive().optional().nullable(),
  // SMS Limits
  smsIncluded: z.number().int().nonnegative().optional().nullable(),
  smsOverageRate: z.number().min(0).optional().nullable(),
  // Email Limits
  emailIncluded: z.number().int().nonnegative().optional().nullable(),
  emailOverageRate: z.number().min(0).optional().nullable(),
  // Storage Limits
  maxStorageMB: z.number().int().positive().optional().nullable(),
  // Membership Limits
  maxMembershipTypes: z.number().int().positive().optional().nullable(),
  features: z.array(z.string()).optional(),
  featureToggles: featureTogglesSchema,
  isPopular: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

// GET /api/superadmin/plans/[id] - Get a specific plan
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const plan = await db.subscriptionPlan.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            organization: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

// PATCH /api/superadmin/plans/[id] - Update a plan
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updatePlanSchema.parse(body);

    // Check if plan exists
    const existingPlan = await db.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // If slug is being changed, check for conflicts
    if (validatedData.slug && validatedData.slug !== existingPlan.slug) {
      const slugConflict = await db.subscriptionPlan.findUnique({
        where: { slug: validatedData.slug },
      });
      if (slugConflict) {
        return NextResponse.json(
          { error: "A plan with this slug already exists" },
          { status: 400 }
        );
      }
    }

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues?.[0]?.message || "Validation error";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("Error updating plan:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}

// DELETE /api/superadmin/plans/[id] - Delete a plan
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

    // Check if plan has active subscriptions
    const activeSubscriptions = await db.organizationSubscription.count({
      where: {
        planId: id,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
    });

    if (activeSubscriptions > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete plan with ${activeSubscriptions} active subscription(s). Deactivate the plan instead.`,
        },
        { status: 400 }
      );
    }

    await db.subscriptionPlan.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting plan:", error);
    return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
  }
}
