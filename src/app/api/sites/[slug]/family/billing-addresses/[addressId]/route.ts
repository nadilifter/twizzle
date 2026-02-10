import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const updateAddressSchema = z.object({
  label: z.string().optional().nullable(),
  street: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  stateProvince: z.string().optional().nullable(),
  postalCode: z.string().min(1).optional(),
  country: z.string().optional(),
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
 * PATCH /api/sites/[slug]/family/billing-addresses/[addressId]
 *
 * Updates an existing billing address belonging to the authenticated user's family.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; addressId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, addressId } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify the address belongs to this family
    const existing = await db.familyBillingAddress.findFirst({
      where: { id: addressId, familyId: family.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateAddressSchema.parse(body);

    // If setting as primary, clear other primaries first
    if (data.isPrimary) {
      await db.familyBillingAddress.updateMany({
        where: { familyId: family.id, isPrimary: true, id: { not: addressId } },
        data: { isPrimary: false },
      });
    }

    const address = await db.familyBillingAddress.update({
      where: { id: addressId },
      data,
    });

    return NextResponse.json({ address });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating billing address:", error);
    return NextResponse.json(
      { error: "Failed to update billing address" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sites/[slug]/family/billing-addresses/[addressId]
 *
 * Deletes a billing address belonging to the authenticated user's family.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; addressId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, addressId } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify the address belongs to this family
    const existing = await db.familyBillingAddress.findFirst({
      where: { id: addressId, familyId: family.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Address not found" },
        { status: 404 }
      );
    }

    await db.familyBillingAddress.delete({ where: { id: addressId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting billing address:", error);
    return NextResponse.json(
      { error: "Failed to delete billing address" },
      { status: 500 }
    );
  }
}
