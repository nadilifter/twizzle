import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { z } from "zod";

const createMembershipGroupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  programTypes: z.array(z.string()).default([]),
  allowAutoRenew: z.boolean().default(false),
});

// GET /api/memberships - List Membership Groups
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeInstances = searchParams.get("include") === "instances";
    const scopedDb = getScopedDb(session.user.organizationId);

    const [groups, total] = await Promise.all([
      scopedDb.membershipGroup.findMany({
        include: {
          _count: {
            select: {
              instances: true,
            },
          },
          instances: includeInstances ? {
             orderBy: { startDate: 'desc' }
          } : undefined,
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.membershipGroup.count(),
    ]);

    return NextResponse.json({
      data: groups,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching membership groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch membership groups" },
      { status: 500 }
    );
  }
}

// POST /api/memberships - Create Membership Group
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    console.log("POST /api/memberships session user:", session?.user);
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let permissions = session.user.permissions || [];
    
    // Fallback: If no permissions in session, verify against DB
    if (permissions.length === 0) {
       console.log("No permissions in session, checking DB...");
       let user = await db.user.findUnique({ 
           where: { id: session.user.id },
           include: { permissions: true }
       });
       
       // Handle stale session ID by checking email
       if (!user && session.user.email) {
           console.log("User not found by ID (stale session?), checking by email...");
           user = await db.user.findUnique({
               where: { email: session.user.email },
               include: { permissions: true }
           });
       }

       if (user) {
           permissions = user.permissions.map(p => p.permission);
           if (user.isSuperAdmin && !permissions.includes("*")) {
               permissions.push("*");
           }
           console.log("Fetched permissions from DB:", permissions);
       }
    }

    if (
      !permissions.includes("*") &&
      !permissions.includes("training.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createMembershipGroupSchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    // Check membership types limit
    const organization = await db.organization.findUnique({
      where: { id: session.user.organizationId! },
      include: {
        subscription: {
          include: { plan: true }
        }
      }
    });

    if (organization?.subscription?.plan?.maxMembershipTypes) {
      const maxTypes = organization.subscription.plan.maxMembershipTypes;
      
      // Get current membership types count
      const currentCount = await scopedDb.membershipGroup.count();
      
      if (currentCount >= maxTypes) {
        return NextResponse.json({ 
          error: `Membership types limit reached. Your plan allows a maximum of ${maxTypes} membership type${maxTypes === 1 ? '' : 's'}. Please upgrade your plan to create more membership types.` 
        }, { status: 400 });
      }
    }

    const group = await scopedDb.membershipGroup.create({
      data: {
        ...validatedData,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating membership group:", error);
    return NextResponse.json(
      { error: `Failed to create membership group: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
