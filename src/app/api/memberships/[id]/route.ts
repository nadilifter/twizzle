import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);

const updateMembershipGroupSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().nullable().optional(),
  programTypes: z.array(z.string()).optional(),

  // Recurrence
  isRecurring: z.boolean().optional(),
  allowAutoRenew: z.boolean().optional(),

  // Default Pricing
  defaultPrice: z.number().min(0).nullable().optional(),
  defaultBillingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).optional(),

  // Instance Generation
  autoGenerateInstances: z.boolean().optional(),
  generationLeadDays: z.number().int().min(1).optional(),

  // Purchase Window
  purchaseWindowDays: z.number().int().min(0).nullable().optional(),

  // Capacity
  capacity: z.number().int().min(0).nullable().optional(),

  // Restriction Flags
  hasGenderRestriction: z.boolean().optional(),
  hasAgeRestriction: z.boolean().optional(),
  hasLevelRestriction: z.boolean().optional(),
  hasCapacityRestriction: z.boolean().optional(),
  hasWaiverRestriction: z.boolean().optional(),
  hasMedicalRequirement: z.boolean().optional(),

  // Restriction Values
  allowedGenders: z.array(genderEnum).optional(),
  minAge: z.number().int().min(0).max(100).nullable().optional(),
  maxAge: z.number().int().min(0).max(100).nullable().optional(),

  glCodeId: z.string().optional().nullable(),
});

// GET /api/memberships/[id]
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);
    const group = await scopedDb.membershipGroup.findUnique({
      where: {
        id: params.id,
      },
      include: {
        instances: {
          orderBy: { startDate: "desc" },
          include: {
            _count: { select: { athleteMemberships: true } },
          },
        },
        levelRequirements: {
          include: { level: { select: { id: true, name: true, color: true } } },
        },
        waiverRequirements: {
          include: { waiver: { select: { id: true, title: true, status: true } } },
        },
        _count: {
          select: {
            instances: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error fetching membership group:", error);
    return NextResponse.json({ error: "Failed to fetch membership group" }, { status: 500 });
  }
}

// PATCH /api/memberships/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    if (
      !session.user.permissions.includes("*") &&
      !session.user.permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateMembershipGroupSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    if (validatedData.glCodeId) {
      const glCode = await scopedDb.gLCode.findUnique({ where: { id: validatedData.glCodeId } });
      if (!glCode) {
        return NextResponse.json({ error: "GL code not found" }, { status: 404 });
      }
    }

    // Fetch current group to check if it's non-recurring (for price sync)
    const currentGroup = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!currentGroup) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    const result = await db.$transaction(async (tx) => {
      const verified = await tx.membershipGroup.findFirst({
        where: { id: params.id, organizationId: session.user.organizationId },
        select: { id: true },
      });
      if (!verified) {
        throw new Error("Membership group not found or access denied");
      }

      const updatedGroup = await tx.membershipGroup.update({
        where: { id: params.id },
        data: validatedData,
      });

      // For non-recurring groups: sync price and name to auto-generated instance
      const isNonRecurring =
        validatedData.isRecurring === false ||
        (!validatedData.isRecurring && !currentGroup.isRecurring);
      const priceChanged = validatedData.defaultPrice !== undefined;
      const nameChanged = validatedData.name !== undefined;

      if (isNonRecurring && (priceChanged || nameChanged)) {
        const updateData: Record<string, unknown> = {};
        if (priceChanged && validatedData.defaultPrice != null) {
          updateData.price = validatedData.defaultPrice;
        }
        if (nameChanged && validatedData.name) {
          updateData.name = validatedData.name;
        }

        if (Object.keys(updateData).length > 0) {
          await tx.membershipInstance.updateMany({
            where: {
              membershipGroupId: params.id,
              isAutoGenerated: true,
            },
            data: updateData,
          });
        }
      }

      return tx.membershipGroup.findUnique({
        where: { id: params.id },
        include: {
          instances: {
            orderBy: { startDate: "desc" },
            include: {
              _count: { select: { athleteMemberships: true } },
            },
          },
          levelRequirements: {
            include: { level: { select: { id: true, name: true, color: true } } },
          },
          waiverRequirements: {
            include: { waiver: { select: { id: true, title: true, status: true } } },
          },
          _count: { select: { instances: true } },
        },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating membership group:", error);
    return NextResponse.json({ error: "Failed to update membership group" }, { status: 500 });
  }
}

// DELETE /api/memberships/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("training.delete")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);

    await scopedDb.membershipGroup.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting membership group:", error);
    return NextResponse.json({ error: "Failed to delete membership group" }, { status: 500 });
  }
}
