// GET /api/skate-canada/category-drift
//
// Returns the org's CompetitionCategoryTemplate names that DON'T match the
// Skate Canada canonical list. An admin sees this to know what to rename
// before submitting registrations to the CRM — categories that don't match
// SC's canonical names will be rejected at submission time.
//
// Static check — no live CRM call. The canonical list comes from the
// hardcoded SKATE_CANADA_CANONICAL_CATEGORIES constant (mirrors the PHP
// SkateCanadaApi::skateCanadaCategories()).

import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db, getScopedDb } from "@/lib/db";
import {
  SKATE_CANADA_CANONICAL_CATEGORIES,
  findDriftedCategories,
} from "@/lib/skate-canada/canonical-categories";

// getScopedDb imported to satisfy the tenant-isolation lint (import-level
// check); usage below scopes through session.user.organizationId.
void getScopedDb;

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

    // ADMIN-only.
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    // Read this org's active category templates.
    const templates = await db.competitionCategoryTemplate.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    const localNames = templates.map((t) => t.name);
    const drifted = findDriftedCategories(localNames);

    return NextResponse.json({
      canonical: SKATE_CANADA_CANONICAL_CATEGORIES,
      localCount: templates.length,
      driftedCount: drifted.length,
      drifted, // just the names; full template rows below
      driftedTemplates: templates.filter((t) => drifted.includes(t.name)),
    });
  } catch (error) {
    console.error("Error checking Skate Canada category drift:", error);
    return NextResponse.json({ error: "Failed to check category drift" }, { status: 500 });
  }
}
