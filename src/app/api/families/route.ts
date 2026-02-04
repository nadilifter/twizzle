import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb } from "@/lib/db";
import { z } from "zod";

const createFamilySchema = z.object({
  name: z.string().min(1, "Name is required"),
  primaryContact: z.string().min(1, "Primary contact is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
});

// GET /api/families - List families for the organization
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require an organization to be selected
    if (!session.user.organizationId) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit: 50,
        offset: 0,
        message: "Please select an organization first"
      });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const scopedDb = getScopedDb(session.user.organizationId);

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { primaryContact: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [families, total] = await Promise.all([
      scopedDb.family.findMany({
        where,
        include: {
          guardians: {
            include: {
              athlete: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: {
              invoices: true,
              paymentMethods: true,
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.family.count({ where }),
    ]);

    const transformedFamilies = families.map(f => ({
      ...f,
      athletes: f.guardians.map(g => g.athlete),
    }));

    return NextResponse.json({
      data: transformedFamilies,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching families:", error);
    return NextResponse.json(
      { error: "Failed to fetch families" },
      { status: 500 }
    );
  }
}

// POST /api/families - Create a new family
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require an organization to be selected
    if (!session.user.organizationId) {
      return NextResponse.json(
        { error: "Please select an organization first" },
        { status: 400 }
      );
    }

    // Super admins bypass permission checks
    const permissions = session.user.permissions ?? [];
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (
      !isSuperAdmin &&
      !permissions.includes("*") &&
      !permissions.includes("families.create")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createFamilySchema.parse(body);
    const scopedDb = getScopedDb(session.user.organizationId);

    const family = await scopedDb.family.create({
      data: {
        ...validatedData,
      },
    });

    return NextResponse.json({
      ...family,
      athletes: [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating family:", error);
    return NextResponse.json(
      { error: "Failed to create family" },
      { status: 500 }
    );
  }
}
