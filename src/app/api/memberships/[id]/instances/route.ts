import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { parseDateOnly } from "@/lib/date-utils";
import { z } from "zod";

const createInstanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0),
  billingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]),
  startDate: z.string().transform((str) => parseDateOnly(str)!),
  endDate: z.string().transform((str) => parseDateOnly(str)!),
  autoRenewDate: z
    .string()
    .optional()
    .transform((str) => (str ? (parseDateOnly(str) ?? undefined) : undefined)),
  purchaseStartDate: z
    .string()
    .optional()
    .transform((str) => (str ? (parseDateOnly(str) ?? undefined) : undefined)),
  purchaseEndDate: z
    .string()
    .optional()
    .transform((str) => (str ? (parseDateOnly(str) ?? undefined) : undefined)),
  capacity: z.number().int().min(0).optional(),
  status: z.enum(["DRAFT", "ACTIVE"]).default("DRAFT"),
  // Registration window
  registrationStartDate: z
    .string()
    .optional()
    .nullable()
    .transform((str) => (str ? (parseDateOnly(str) ?? undefined) : undefined)),
  registrationStartTime: z.string().optional().nullable(),
  registrationEndDate: z
    .string()
    .optional()
    .nullable()
    .transform((str) => (str ? (parseDateOnly(str) ?? undefined) : undefined)),
  registrationEndTime: z.string().optional().nullable(),
  registrationOpen: z.boolean().default(true),
  earlyAccessCode: z.string().optional().nullable(),
});

// GET /api/memberships/[id]/instances
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const scopedDb = getScopedDb(session.user.organizationId);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    const instances = await scopedDb.membershipInstance.findMany({
      where: {
        membershipGroupId: params.id,
        ...(statusFilter
          ? { status: statusFilter as "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED" | "ARCHIVED" }
          : {}),
      },
      orderBy: { startDate: "desc" },
      include: {
        _count: {
          select: { athleteMemberships: true },
        },
      },
    });

    return NextResponse.json(instances);
  } catch (error) {
    console.error("Error fetching instances:", error);
    return NextResponse.json({ error: "Failed to fetch instances" }, { status: 500 });
  }
}

// POST /api/memberships/[id]/instances
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "memberships");
    if (gate) return gate;

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("training.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createInstanceSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    // For non-recurring groups, prevent creating additional instances
    if (!group.isRecurring) {
      const existingCount = await scopedDb.membershipInstance.count({
        where: { membershipGroupId: params.id },
      });
      if (existingCount > 0) {
        return NextResponse.json(
          { error: "Non-recurring membership groups can only have one instance" },
          { status: 400 }
        );
      }
    }

    const instance = await scopedDb.membershipInstance.create({
      data: {
        membershipGroupId: params.id,
        name: validatedData.name,
        price: validatedData.price,
        billingInterval: validatedData.billingInterval,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        autoRenewDate: validatedData.autoRenewDate,
        purchaseStartDate: validatedData.purchaseStartDate,
        purchaseEndDate: validatedData.purchaseEndDate,
        capacity: validatedData.capacity,
        status: validatedData.status,
        registrationOpen: validatedData.registrationOpen,
        registrationStartDate: validatedData.registrationStartDate,
        registrationStartTime: validatedData.registrationStartTime,
        registrationEndDate: validatedData.registrationEndDate,
        registrationEndTime: validatedData.registrationEndTime,
        earlyAccessCode: validatedData.earlyAccessCode,
      },
      include: {
        _count: { select: { athleteMemberships: true } },
      },
    });

    return NextResponse.json(instance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating instance:", error);
    return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
  }
}
