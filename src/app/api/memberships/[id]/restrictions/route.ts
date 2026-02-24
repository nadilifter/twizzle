import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const addLevelRequirementSchema = z.object({
  type: z.literal("level"),
  levelId: z.string().min(1, "Level ID is required"),
});

const addWaiverRequirementSchema = z.object({
  type: z.literal("waiver"),
  waiverId: z.string().min(1, "Waiver ID is required"),
});

const addRequirementSchema = z.discriminatedUnion("type", [
  addLevelRequirementSchema,
  addWaiverRequirementSchema,
]);

const deleteRequirementSchema = z.object({
  type: z.enum(["level", "waiver"]),
  id: z.string().min(1, "Requirement ID is required"),
});

// GET /api/memberships/[id]/restrictions - Get all restrictions for a membership group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);

    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
      include: {
        levelRequirements: {
          include: {
            level: { select: { id: true, name: true, color: true, order: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        waiverRequirements: {
          include: {
            waiver: { select: { id: true, title: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      levelRequirements: group.levelRequirements,
      waiverRequirements: group.waiverRequirements,
      // Include the group-level restriction config for context
      restrictions: {
        hasGenderRestriction: group.hasGenderRestriction,
        hasAgeRestriction: group.hasAgeRestriction,
        hasLevelRestriction: group.hasLevelRestriction,
        hasCapacityRestriction: group.hasCapacityRestriction,
        hasWaiverRestriction: group.hasWaiverRestriction,
        hasMedicalRequirement: group.hasMedicalRequirement,
        allowedGenders: group.allowedGenders,
        minAge: group.minAge,
        maxAge: group.maxAge,
        capacity: group.capacity,
      },
    });
  } catch (error) {
    console.error("Error fetching restrictions:", error);
    return NextResponse.json({ error: "Failed to fetch restrictions" }, { status: 500 });
  }
}

// POST /api/memberships/[id]/restrictions - Add a level or waiver requirement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = addRequirementSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    if (validatedData.type === "level") {
      // Verify level belongs to organization
      const level = await scopedDb.level.findFirst({
        where: { id: validatedData.levelId },
      });

      if (!level) {
        return NextResponse.json({ error: "Level not found" }, { status: 404 });
      }

      const requirement = await db.membershipGroupLevelRequirement.create({
        data: {
          membershipGroupId: params.id,
          levelId: validatedData.levelId,
        },
        include: {
          level: { select: { id: true, name: true, color: true } },
        },
      });

      return NextResponse.json(requirement, { status: 201 });
    }

    if (validatedData.type === "waiver") {
      // Verify waiver belongs to organization
      const waiver = await scopedDb.waiver.findFirst({
        where: { id: validatedData.waiverId },
      });

      if (!waiver) {
        return NextResponse.json({ error: "Waiver not found" }, { status: 404 });
      }

      const requirement = await db.membershipGroupWaiverRequirement.create({
        data: {
          membershipGroupId: params.id,
          waiverId: validatedData.waiverId,
        },
        include: {
          waiver: { select: { id: true, title: true, status: true } },
        },
      });

      return NextResponse.json(requirement, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid requirement type" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error adding restriction:", error);
    return NextResponse.json({ error: "Failed to add restriction" }, { status: 500 });
  }
}

// DELETE /api/memberships/[id]/restrictions?type=level|waiver&id=requirementId
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("training.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const requirementId = searchParams.get("id");

    if (!type || !requirementId || !["level", "waiver"].includes(type)) {
      return NextResponse.json({ error: "type and id query params are required" }, { status: 400 });
    }

    if (type === "level") {
      await db.membershipGroupLevelRequirement.delete({
        where: { id: requirementId },
      });
    } else if (type === "waiver") {
      await db.membershipGroupWaiverRequirement.delete({
        where: { id: requirementId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing restriction:", error);
    return NextResponse.json({ error: "Failed to remove restriction" }, { status: 500 });
  }
}
