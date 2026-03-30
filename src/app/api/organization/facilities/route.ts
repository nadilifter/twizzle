import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";
import { geocodeAddress } from "@/lib/geocode";

const createFacilitySchema = z.object({
  name: z.string().min(1, "Name is required"),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  stateProvince: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z
    .string()
    .refine((val) => !val || isValidPhoneNumber(val), "Please enter a valid phone number")
    .optional()
    .nullable(),
  email: z.string().email().optional().nullable(),
  squareFootage: z.number().optional().nullable(),
  maxCapacity: z.number().optional().nullable(),
  description: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

// GET - List all facilities for the organization
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const facilities = await db.facility.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            spaces: true,
            equipment: true,
            assignments: true,
            events: true,
          },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });

    return NextResponse.json(facilities);
  } catch (error) {
    console.error("Error fetching facilities:", error);
    return NextResponse.json({ error: "Failed to fetch facilities" }, { status: 500 });
  }
}

// POST - Create a new facility
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = createFacilitySchema.parse(body);

    // If this is set as default, unset other defaults
    if (validatedData.isDefault) {
      await db.facility.updateMany({
        where: { organizationId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const coords = await geocodeAddress({
      street: validatedData.street,
      city: validatedData.city,
      stateProvince: validatedData.stateProvince,
      postalCode: validatedData.postalCode,
      country: validatedData.country,
    });

    const facility = await db.facility.create({
      data: {
        organizationId,
        name: validatedData.name,
        street: validatedData.street ?? null,
        city: validatedData.city ?? null,
        stateProvince: validatedData.stateProvince ?? null,
        postalCode: validatedData.postalCode ?? null,
        country: validatedData.country ?? null,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        phone: validatedData.phone ?? null,
        email: validatedData.email ?? null,
        squareFootage: validatedData.squareFootage ?? null,
        maxCapacity: validatedData.maxCapacity ?? null,
        description: validatedData.description ?? null,
        isDefault: validatedData.isDefault ?? false,
        status: "ACTIVE",
      },
      include: {
        _count: {
          select: {
            spaces: true,
            equipment: true,
            assignments: true,
            events: true,
          },
        },
      },
    });

    return NextResponse.json(facility, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating facility:", error);
    return NextResponse.json({ error: "Failed to create facility" }, { status: 500 });
  }
}
