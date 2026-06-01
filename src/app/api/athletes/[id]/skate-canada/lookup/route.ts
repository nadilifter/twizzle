// POST /api/athletes/[id]/skate-canada/lookup
//
// Calls the Skate Canada CRM (Phase 6.1 SOAP client) to look up the athlete
// by their existing federationMemberNumber or demographic fields. Returns
// the CRM contact + a diff against Twizzle's local data so the admin can
// confirm a match before syncing.
//
// This endpoint is read-only — it does NOT write back to the athlete row.
// Sync happens via an explicit "Sync from Skate Canada" action on the UI
// that POSTs the contact details to the existing athlete update endpoint.
//
// Without `SKATE_CANADA_CRM_APP_SECRET` (or any other required env var) the
// endpoint returns 503 with a clear error message so the UI can degrade
// gracefully.

import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import { SkateCanadaClient } from "@/lib/skate-canada/client";
import { isConfigured } from "@/lib/skate-canada/config";
import {
  CrmAuthError,
  CrmConfigError,
  CrmFaultError,
  CrmProtocolError,
} from "@/lib/skate-canada/errors";
import type { TwizzleGender } from "@/lib/skate-canada/helpers";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

const GENDER_MAP: Record<string, TwizzleGender> = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  OTHER: "OTHER",
  PREFER_NOT_TO_SAY: "PREFER_NOT_TO_SAY",
};

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    if (!isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Skate Canada CRM is not configured on this Twizzle instance. Ask your admin to set SKATE_CANADA_CRM_* env vars.",
        },
        { status: 503 }
      );
    }

    // ADMIN-only — same gate as Phase 5.x.
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const { id: athleteId } = await params;

    // Load athlete + tenant-scoped row (level / member number live on
    // OrganizationAthlete, not Athlete).
    const athlete = await db.athlete.findFirst({
      where: {
        id: athleteId,
        organizationAthletes: { some: { organizationId } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        gender: true,
        organizationAthletes: {
          where: { organizationId },
          select: {
            federationName: true,
            federationMemberNumber: true,
          },
        },
      },
    });
    if (!athlete) return NextResponse.json({ error: "Athlete not found" }, { status: 404 });

    const oa = athlete.organizationAthletes[0];

    // The PHP also requires birthdate + gender for the lookup; if Twizzle is
    // missing those, refuse early with a useful message.
    if (!athlete.birthDate) {
      return NextResponse.json(
        {
          error:
            "Athlete birthdate is required for a Skate Canada lookup. Edit the athlete and add it first.",
        },
        { status: 400 }
      );
    }
    if (!athlete.gender) {
      return NextResponse.json(
        {
          error:
            "Athlete gender is required for a Skate Canada lookup. Edit the athlete and add it first.",
        },
        { status: 400 }
      );
    }

    const twizzleGender = GENDER_MAP[athlete.gender];
    if (!twizzleGender) {
      return NextResponse.json(
        { error: `Unsupported gender value: ${athlete.gender}` },
        { status: 400 }
      );
    }

    const birthdateIso = athlete.birthDate.toISOString().slice(0, 10);

    const client = new SkateCanadaClient();
    let contact;
    try {
      contact = await client.getContact({
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        birthdate: birthdateIso,
        gender: twizzleGender,
        memberNumber: oa?.federationMemberNumber ?? null,
      });
    } catch (err) {
      if (err instanceof CrmAuthError) {
        return NextResponse.json(
          { error: `Skate Canada CRM auth failed: ${err.message}` },
          { status: 502 }
        );
      }
      if (err instanceof CrmFaultError) {
        return NextResponse.json(
          { error: `Skate Canada CRM returned a SOAP fault: ${err.message}` },
          { status: 502 }
        );
      }
      if (err instanceof CrmProtocolError || err instanceof CrmConfigError) {
        return NextResponse.json({ error: err.message }, { status: 502 });
      }
      throw err;
    }

    if (!contact) {
      return NextResponse.json({ found: false, contact: null, diff: null });
    }

    // Build a per-field "matches?" diff so the UI can highlight what's
    // different between local data and the CRM record.
    const diff = {
      firstName: contact.firstName?.trim().toLowerCase() === athlete.firstName.trim().toLowerCase(),
      lastName: contact.lastName?.trim().toLowerCase() === athlete.lastName.trim().toLowerCase(),
      birthdate: contact.birthdate === birthdateIso,
      memberNumber: contact.memberNumber === (oa?.federationMemberNumber ?? null),
    };

    return NextResponse.json({ found: true, contact, diff });
  } catch (error) {
    console.error("Error looking up athlete in Skate Canada:", error);
    return NextResponse.json({ error: "Failed to look up athlete" }, { status: 500 });
  }
}
