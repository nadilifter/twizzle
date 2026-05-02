import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // tenant-isolation-ok: public cart validation endpoint with no session; organizationId passed from client for Product queries
import { checkApiRateLimit } from "@/lib/rate-limit";

interface ValidateItem {
  referenceId: string;
  type: "program" | "event" | "item" | "membership" | "competition" | "pass";
}

/**
 * Accepts a list of cart item references and returns which ones still exist
 * in the database. Used by the client-side cart to evict stale items that
 * reference deleted entities.
 */
export async function POST(request: NextRequest) {
  const rateLimited = await checkApiRateLimit(request, "cart-validate");
  if (rateLimited) return rateLimited;

  try {
    const { items, organizationId } = (await request.json()) as {
      items: ValidateItem[];
      organizationId?: string;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: [] });
    }

    const grouped: Record<string, string[]> = {};
    for (const item of items) {
      const key = item.type;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item.referenceId);
    }

    const validIds = new Set<string>();
    const productFulfillment: Record<
      string,
      {
        fulfillmentType: "PICKUP_ONLY" | "DELIVERY_ONLY" | "PICKUP_OR_DELIVERY";
        pickupFacility: {
          id: string;
          name: string;
          street: string | null;
          city: string | null;
          stateProvince: string | null;
          postalCode: string | null;
          operatingHours: { dayOfWeek: number; openTime: string; closeTime: string }[];
        } | null;
      }
    > = {};

    const checks: Promise<void>[] = [];

    if (grouped.program) {
      checks.push(
        (async () => {
          // referenceId can be either a Program.id or ProgramInstance.id
          const [programs, instances] = await Promise.all([
            db.program.findMany({
              where: { id: { in: grouped.program } },
              select: { id: true },
            }),
            db.programInstance.findMany({
              where: { id: { in: grouped.program } },
              select: { id: true },
            }),
          ]);
          for (const p of programs) validIds.add(p.id);
          for (const i of instances) validIds.add(i.id);
        })()
      );
    }

    if (grouped.event) {
      checks.push(
        db.event
          .findMany({
            where: { id: { in: grouped.event } },
            select: { id: true },
          })
          .then((rows) => rows.forEach((r) => validIds.add(r.id)))
      );
    }

    if (grouped.membership) {
      checks.push(
        db.membershipInstance
          .findMany({
            where: { id: { in: grouped.membership } },
            select: { id: true },
          })
          .then((rows) => rows.forEach((r) => validIds.add(r.id)))
      );
    }

    if (grouped.competition) {
      checks.push(
        db.competition
          .findMany({
            where: { id: { in: grouped.competition } },
            select: { id: true },
          })
          .then((rows) => rows.forEach((r) => validIds.add(r.id)))
      );
    }

    if (grouped.pass) {
      checks.push(
        db.pass
          .findMany({
            where: { id: { in: grouped.pass } },
            select: { id: true },
          })
          .then((rows) => rows.forEach((r) => validIds.add(r.id)))
      );
    }

    if (grouped.item) {
      checks.push(
        db.product
          .findMany({
            where: {
              id: { in: grouped.item },
              isActive: true,
              ...(organizationId ? { organizationId } : {}),
            },
            select: {
              id: true,
              fulfillmentType: true,
              pickupFacility: {
                select: {
                  id: true,
                  name: true,
                  street: true,
                  city: true,
                  stateProvince: true,
                  postalCode: true,
                  operatingHours: {
                    select: { dayOfWeek: true, openTime: true, closeTime: true },
                    orderBy: [{ dayOfWeek: "asc" }, { openTime: "asc" }],
                  },
                },
              },
            },
          })
          .then((rows) =>
            rows.forEach((r) => {
              validIds.add(r.id);
              productFulfillment[r.id] = {
                fulfillmentType: r.fulfillmentType,
                pickupFacility: r.pickupFacility,
              };
            })
          )
      );
    }

    await Promise.all(checks);

    const valid = items.filter((i) => validIds.has(i.referenceId)).map((i) => i.referenceId);

    return NextResponse.json({ valid, productFulfillment });
  } catch {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
