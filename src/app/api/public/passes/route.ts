import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-resolver";
import { resolvePublicRequest } from "@/lib/public-api";
import { checkApiRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const rateLimited = await checkApiRateLimit(request, "public");
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const result = await resolvePublicRequest(request, searchParams.get("organizationId"));
    if (result instanceof NextResponse) return result;
    const { organizationId } = result;

    const passesEnabled = await isFeatureEnabled(organizationId, "passes");
    if (!passesEnabled) {
      return NextResponse.json({ data: [] });
    }

    const passes = await db.pass.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
      },
      include: {
        coveredPrograms: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            name: true,
            basePrice: true,
            perSessionPrice: true,
            pricingModel: true,
          },
        },
        _count: { select: { athletePasses: true } },
      },
      orderBy: { name: "asc" },
    });

    let allActivePrograms: Array<{
      id: string;
      name: string;
      basePrice: any;
      perSessionPrice: any;
      pricingModel: string;
    }> | null = null;
    const hasAnyAllPrograms = passes.some((p) => p.coversAllPrograms);
    if (hasAnyAllPrograms) {
      allActivePrograms = await db.program.findMany({
        where: { organizationId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          basePrice: true,
          perSessionPrice: true,
          pricingModel: true,
        },
      });
    }

    const data = passes.map((pass) => ({
      id: pass.id,
      name: pass.name,
      description: pass.description,
      price: pass.price,
      billingInterval: pass.billingInterval,
      sessionLimit: pass.sessionLimit,
      limitPeriod: pass.limitPeriod,
      coversAllPrograms: pass.coversAllPrograms,
      coveredPrograms: pass.coversAllPrograms ? (allActivePrograms ?? []) : pass.coveredPrograms,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error fetching public passes:", error);
    return NextResponse.json({ error: "Failed to fetch passes" }, { status: 500 });
  }
}
