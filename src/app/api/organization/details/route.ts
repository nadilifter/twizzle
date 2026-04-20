import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isValidPhoneNumber } from "libphonenumber-js";
import { geocodeAddress, hasAddressChanged } from "@/lib/geocode";

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

    const organization = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        latitude: true,
        longitude: true,
        taxRate: true,
        taxEnabled: true,
        createdAt: true,
        facilities: {
          where: { latitude: { not: null }, longitude: { not: null } },
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            street: true,
            city: true,
            stateProvince: true,
          },
          take: 10,
        },
        _count: {
          select: {
            members: {
              where: {
                user: { email: { not: { endsWith: "@uplifterinc.com" } } },
              },
            },
            organizationAthletes: true,
            programs: true,
          },
        },
        subscription: {
          select: {
            status: true,
            nextBillingDate: true,
            plan: {
              select: { name: true },
            },
          },
        },
        sports: {
          include: {
            sport: {
              select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                icon: true,
              },
            },
          },
          orderBy: { sport: { displayOrder: "asc" } },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to fetch organization details:", error);
    return NextResponse.json({ error: "Failed to fetch organization details" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    // Only owners/admins should be able to update organization details
    if (
      session.user.role !== "OWNER" &&
      session.user.role !== "ADMIN" &&
      !session.user.isSuperAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    const {
      name,
      email,
      phone,
      street,
      city,
      stateProvince,
      postalCode,
      country,
      taxRate,
      taxEnabled,
    } = data;

    if (phone && !isValidPhoneNumber(phone)) {
      return NextResponse.json({ error: "Please enter a valid phone number" }, { status: 400 });
    }

    // Validate 2-letter codes for Adyen compliance
    if (stateProvince && stateProvince.length > 2) {
      return NextResponse.json(
        { error: "State/Province must be a 2-letter code" },
        { status: 400 }
      );
    }
    if (country && country.length > 2) {
      return NextResponse.json({ error: "Country must be a 2-letter code" }, { status: 400 });
    }

    if (taxRate !== undefined && (typeof taxRate !== "number" || taxRate < 0 || taxRate > 1)) {
      return NextResponse.json(
        { error: "Tax rate must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    // Geocode if address changed or coordinates are missing
    const current = await db.organization.findUnique({
      where: { id: organizationId },
      select: {
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        latitude: true,
        longitude: true,
      },
    });

    const incoming = { street, city, stateProvince, postalCode, country };
    const addressChanged = current && hasAddressChanged(incoming, current);
    const missingCoords = !current?.latitude || !current?.longitude;
    let coords: { latitude: number; longitude: number } | null = null;

    if (addressChanged || missingCoords) {
      const addrToGeocode = {
        street: street ?? current?.street,
        city: city ?? current?.city,
        stateProvince: stateProvince ?? current?.stateProvince,
        postalCode: postalCode ?? current?.postalCode,
        country: country ?? current?.country,
      };
      coords = await geocodeAddress(addrToGeocode);
    }

    const organization = await db.organization.update({
      where: { id: organizationId },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(stateProvince !== undefined && { stateProvince }),
        ...(postalCode !== undefined && { postalCode }),
        ...(country !== undefined && { country }),
        ...(taxRate !== undefined && { taxRate }),
        ...(taxEnabled !== undefined && { taxEnabled }),
        ...(coords && { latitude: coords.latitude, longitude: coords.longitude }),
      },
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Failed to update organization details:", error);
    return NextResponse.json({ error: "Failed to update organization details" }, { status: 500 });
  }
}
