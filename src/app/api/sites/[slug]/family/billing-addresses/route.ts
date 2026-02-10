import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const createAddressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  stateProvince: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().default("US"),
  isPrimary: z.boolean().optional(),
});

/** Resolve the family for the authenticated user in this org. */
async function resolveFamily(slug: string, userEmail: string) {
  const config = await db.websiteConfig.findUnique({
    where: { subdomain: slug },
    select: { organizationId: true },
  });
  if (!config) return null;

  const family = await db.family.findFirst({
    where: { email: userEmail, organizationId: config.organizationId },
    select: { id: true },
  });
  return family;
}

/**
 * GET /api/sites/[slug]/family/billing-addresses
 *
 * Returns all FamilyBillingAddress records for the authenticated user's family.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json({ addresses: [] });
    }

    const addresses = await db.familyBillingAddress.findMany({
      where: { familyId: family.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("Error fetching billing addresses:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing addresses" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites/[slug]/family/billing-addresses
 *
 * Creates a new billing address for the authenticated user's family.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json(
        { error: "Family not found. Please complete a purchase first." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = createAddressSchema.parse(body);

    // If this is set as primary, clear other primaries first
    if (data.isPrimary) {
      await db.familyBillingAddress.updateMany({
        where: { familyId: family.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const address = await db.familyBillingAddress.create({
      data: {
        familyId: family.id,
        label: data.label,
        street: data.street,
        city: data.city,
        stateProvince: data.stateProvince,
        postalCode: data.postalCode,
        country: data.country,
        isPrimary: data.isPrimary ?? false,
      },
    });

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating billing address:", error);
    return NextResponse.json(
      { error: "Failed to create billing address" },
      { status: 500 }
    );
  }
}
