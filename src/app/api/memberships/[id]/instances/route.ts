import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const createInstanceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0),
  billingInterval: z.enum(["MONTHLY", "YEARLY", "SESSION"]),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z.string().transform((str) => new Date(str)),
  autoRenewDate: z.string().optional().transform((str) => str ? new Date(str) : undefined),
});

// GET /api/memberships/[id]/instances
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedDb = getScopedDb(session.user.organizationId);
    
    // Verify group exists
    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    const instances = await scopedDb.membershipInstance.findMany({
      where: { membershipGroupId: params.id },
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: { athleteMemberships: true }
        }
      }
    });

    return NextResponse.json(instances);
  } catch (error) {
    console.error("Error fetching instances:", error);
    return NextResponse.json({ error: "Failed to fetch instances" }, { status: 500 });
  }
}

// POST /api/memberships/[id]/instances
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (
      !permissions.includes("*") &&
      !permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createInstanceSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    // Verify group exists
    const group = await scopedDb.membershipGroup.findUnique({
      where: { id: params.id },
    });

    if (!group) {
      return NextResponse.json({ error: "Membership Group not found" }, { status: 404 });
    }

    const instance = await scopedDb.membershipInstance.create({
      data: {
        membershipGroupId: params.id,
        ...validatedData,
      },
    });

    return NextResponse.json(instance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating instance:", error);
    return NextResponse.json(
      { error: "Failed to create instance" },
      { status: 500 }
    );
  }
}
