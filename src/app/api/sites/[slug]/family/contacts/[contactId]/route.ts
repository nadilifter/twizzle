import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const updateContactSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  relationship: z.string().optional().nullable(),
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
 * PATCH /api/sites/[slug]/family/contacts/[contactId]
 *
 * Updates an existing contact belonging to the authenticated user's family.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; contactId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, contactId } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify the contact belongs to this family
    const existing = await db.familyContact.findFirst({
      where: { id: contactId, familyId: family.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const data = updateContactSchema.parse(body);

    // If setting as primary, clear other primaries first
    if (data.isPrimary) {
      await db.familyContact.updateMany({
        where: { familyId: family.id, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    const contact = await db.familyContact.update({
      where: { id: contactId },
      data,
    });

    return NextResponse.json({ contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating family contact:", error);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sites/[slug]/family/contacts/[contactId]
 *
 * Deletes a contact belonging to the authenticated user's family.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; contactId: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { slug, contactId } = await params;
    const family = await resolveFamily(slug, session.user.email);
    if (!family) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    // Verify the contact belongs to this family
    const existing = await db.familyContact.findFirst({
      where: { id: contactId, familyId: family.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Contact not found" },
        { status: 404 }
      );
    }

    await db.familyContact.delete({ where: { id: contactId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family contact:", error);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
