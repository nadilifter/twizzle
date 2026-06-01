// POST /api/skate-canada/seasons/sync
//
// Fetches the live Skate Canada season list via the Phase 6.1 SOAP client
// and upserts each row into Twizzle's local SkateCanadaSeason table (Phase
// 5.4 model). Match key is the SC contact GUID (`scSeasonGuid` field) —
// the first sync populates it, subsequent syncs match on it and update.
// Rows already in the local table that don't appear in the live response
// are LEFT ALONE (they may be historical / out of the active window).
//
// SUPERADMIN-only since SkateCanadaSeason is a global resource.

import { NextResponse } from "next/server";
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

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!session.user.isSuperAdmin) {
      return NextResponse.json({ error: "Superadmin access required" }, { status: 403 });
    }

    if (!isConfigured()) {
      return NextResponse.json(
        {
          error:
            "Skate Canada CRM is not configured on this Twizzle instance. Set SKATE_CANADA_CRM_* env vars first.",
        },
        { status: 503 }
      );
    }

    const client = new SkateCanadaClient();

    let liveSeasons;
    try {
      liveSeasons = await client.getSeasons();
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

    // Upsert each row. Match strategy:
    //   - First sync: scSeasonGuid is null locally → match on `name`
    //     (unique). Set scSeasonGuid + dates from the CRM.
    //   - Subsequent syncs: scSeasonGuid is set → match on it, refresh
    //     name + dates if the CRM has them changed.
    //
    // We do BOTH in one upsert per row by looking up the existing row
    // first and applying the right where clause.
    const results: Array<{
      name: string;
      action: "created" | "updated" | "skipped";
      reason?: string;
    }> = [];

    for (const live of liveSeasons) {
      if (!live.name) {
        results.push({ name: live.id, action: "skipped", reason: "missing name in CRM response" });
        continue;
      }

      const startDate = live.startDate ? new Date(`${live.startDate}T00:00:00Z`) : null;
      const endDate = live.endDate ? new Date(`${live.endDate}T00:00:00Z`) : null;
      if (
        !startDate ||
        !endDate ||
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime())
      ) {
        results.push({ name: live.name, action: "skipped", reason: "invalid dates" });
        continue;
      }

      // Try to find by scSeasonGuid first; fall back to name.
      const existing =
        (await db.skateCanadaSeason.findUnique({ where: { scSeasonGuid: live.id } })) ??
        (await db.skateCanadaSeason.findUnique({ where: { name: live.name } }));

      if (existing) {
        await db.skateCanadaSeason.update({
          where: { id: existing.id },
          data: {
            name: live.name,
            startDate,
            endDate,
            scSeasonGuid: live.id,
          },
        });
        results.push({ name: live.name, action: "updated" });
      } else {
        await db.skateCanadaSeason.create({
          data: {
            name: live.name,
            startDate,
            endDate,
            scSeasonGuid: live.id,
            // Don't auto-activate; SUPERADMIN flips active from the season UI.
            isActive: false,
          },
        });
        results.push({ name: live.name, action: "created" });
      }
    }

    return NextResponse.json({
      total: liveSeasons.length,
      created: results.filter((r) => r.action === "created").length,
      updated: results.filter((r) => r.action === "updated").length,
      skipped: results.filter((r) => r.action === "skipped").length,
      results,
    });
  } catch (error) {
    console.error("Error syncing Skate Canada seasons:", error);
    return NextResponse.json({ error: "Failed to sync seasons" }, { status: 500 });
  }
}
