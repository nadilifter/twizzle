import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { z } from "zod";

const createContactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  relationship: z.string().optional(),
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
 * GET /api/sites/[slug]/family/contacts
 *
 * Returns all FamilyContact records for the authenticated user's family.
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
      return NextResponse.json({ contacts: [] });
    }

    const contacts = await db.familyContact.findMany({
      where: { familyId: family.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("Error fetching family contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sites/[slug]/family/contacts
 *
 * Creates a new contact for the authenticated user's family.
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
    const data = createContactSchema.parse(body);

    // If this is set as primary, clear other primaries first
    if (data.isPrimary) {
      await db.familyContact.updateMany({
        where: { familyId: family.id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await db.familyContact.create({
      data: {
        familyId: family.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        relationship: data.relationship,
        isPrimary: data.isPrimary ?? false,
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating family contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
