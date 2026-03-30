import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createReservedDomainSchema = z.object({
  pattern: z
    .string()
    .min(1, "Pattern is required")
    .regex(/^[a-z0-9-]+$/, "Pattern must only contain lowercase letters, numbers, and hyphens"),
  type: z.enum(["EXACT", "PREFIX"]),
  reason: z.string().optional(),
});

// GET - List all reserved domains
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reservedDomains = await db.reservedDomain.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reservedDomains);
  } catch (error) {
    console.error("Error fetching reserved domains:", error);
    return NextResponse.json({ error: "Failed to fetch reserved domains" }, { status: 500 });
  }
}

// POST - Create a new reserved domain
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.isSuperAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createReservedDomainSchema.parse(body);

    // Check if pattern already exists
    const existing = await db.reservedDomain.findUnique({
      where: { pattern: validated.pattern },
    });

    if (existing) {
      return NextResponse.json({ error: "This pattern is already reserved" }, { status: 400 });
    }

    // Check if this pattern would conflict with existing subdomains
    const conflictingConfigs = await checkExistingConflicts(validated.pattern, validated.type);

    const reservedDomain = await db.reservedDomain.create({
      data: {
        pattern: validated.pattern,
        type: validated.type,
        reason: validated.reason || null,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json(
      {
        ...reservedDomain,
        conflicts: conflictingConfigs,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating reserved domain:", error);
    return NextResponse.json({ error: "Failed to create reserved domain" }, { status: 500 });
  }
}

// Helper to check if any existing subdomains would conflict
async function checkExistingConflicts(
  pattern: string,
  type: "EXACT" | "PREFIX"
): Promise<string[]> {
  if (type === "EXACT") {
    const existing = await db.websiteConfig.findUnique({
      where: { subdomain: pattern },
      select: { subdomain: true },
    });
    return existing ? [existing.subdomain!] : [];
  } else {
    // PREFIX - find all subdomains starting with this pattern
    const existing = await db.websiteConfig.findMany({
      where: {
        subdomain: {
          startsWith: pattern,
        },
      },
      select: { subdomain: true },
    });
    return existing.map((e) => e.subdomain!).filter(Boolean);
  }
}
