import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getScopedDb, db } from "@/lib/db";
import { checkFeatureGate } from "@/lib/feature-resolver";
import { z } from "zod";

const createPassSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be non-negative"),
  billingInterval: z.enum(["ONE_TIME", "MONTHLY", "YEARLY", "SESSION"]).default("MONTHLY"),
  sessionLimit: z.number().int().min(1, "Session limit must be at least 1"),
  limitPeriod: z.enum(["WEEKLY", "MONTHLY"]).default("WEEKLY"),
  coversAllPrograms: z.boolean().default(false),
  programIds: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "passes");
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const include = searchParams.get("include") || "";
    const scopedDb = getScopedDb(session.user.organizationId);

    const [passes, total] = await Promise.all([
      scopedDb.pass.findMany({
        include: {
          _count: {
            select: {
              athletePasses: true,
              coveredPrograms: true,
            },
          },
          coveredPrograms: include.includes("programs")
            ? { select: { id: true, name: true, status: true, basePrice: true, perSessionPrice: true, pricingModel: true } }
            : undefined,
          athletePasses: include.includes("athletes")
            ? {
                include: {
                  athlete: { select: { id: true, firstName: true, lastName: true, name: true } },
                },
              }
            : undefined,
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      scopedDb.pass.count(),
    ]);

    return NextResponse.json({ data: passes, total, limit, offset });
  } catch (error) {
    console.error("Error fetching passes:", error);
    return NextResponse.json({ error: "Failed to fetch passes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gate = await checkFeatureGate(session.user.organizationId, "passes");
    if (gate) return gate;

    let permissions = session.user.permissions || [];

    if (permissions.length === 0) {
      const member = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: session.user.organizationId },
        include: { permissions: true },
      });
      if (member) {
        permissions = member.permissions.map((p) => p.permission);
      }
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { isSuperAdmin: true },
      });
      if (user?.isSuperAdmin && !permissions.includes("*")) {
        permissions.push("*");
      }
    }

    if (!permissions.includes("*") && !permissions.includes("training.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createPassSchema.parse(body);

    const pass = await db.pass.create({
      data: {
        organizationId: session.user.organizationId!,
        name: validatedData.name,
        description: validatedData.description,
        price: validatedData.price,
        billingInterval: validatedData.billingInterval,
        sessionLimit: validatedData.sessionLimit,
        limitPeriod: validatedData.limitPeriod,
        coversAllPrograms: validatedData.coversAllPrograms,
        ...(validatedData.programIds && validatedData.programIds.length > 0 && !validatedData.coversAllPrograms
          ? { coveredPrograms: { connect: validatedData.programIds.map((id) => ({ id })) } }
          : {}),
      },
      include: {
        coveredPrograms: { select: { id: true, name: true, status: true, basePrice: true, perSessionPrice: true, pricingModel: true } },
        _count: { select: { athletePasses: true, coveredPrograms: true } },
      },
    });

    return NextResponse.json(pass);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating pass:", error);
    return NextResponse.json({ error: "Failed to create pass" }, { status: 500 });
  }
}
