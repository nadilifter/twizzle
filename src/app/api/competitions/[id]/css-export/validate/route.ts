import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCssExport } from "@/lib/css-export";
import { fetchCssExportInput } from "../shared";

// Allowlisted in scripts/tenant-isolation-allowlist.txt — every query in this
// route is filtered by organizationId from the authenticated session.

/**
 * GET /api/competitions/[id]/css-export/validate
 *
 * Returns a JSON summary of what would be exported: count of exportable
 * entries, list of blocked entries with human-readable reasons (missing
 * federation #, expired membership, etc.). Lets the UI render a pre-flight
 * modal before the user triggers the actual CSV download.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const organizationId = session.user.organizationId;
    if (!organizationId)
      return NextResponse.json({ error: "No organization context" }, { status: 400 });

    const perms = session.user.permissions ?? [];
    if (
      !perms.includes("*") &&
      !perms.includes("competitions.view") &&
      !perms.includes("competitions.edit")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const input = await fetchCssExportInput(db, id, organizationId);
    if (!input) return NextResponse.json({ error: "Competition not found" }, { status: 404 });

    const result = buildCssExport(input);

    return NextResponse.json({
      competition: { id: input.competition.id, name: input.competition.name },
      organization: {
        name: input.organization.name,
        federationSection: input.organization.federationSection,
      },
      totals: {
        entries: input.entries.length,
        exportable: result.rows.length,
        blocked: result.blocked.length,
      },
      blocked: result.blocked,
    });
  } catch (err) {
    console.error("CSS export validate error:", err);
    return NextResponse.json({ error: "Failed to validate export" }, { status: 500 });
  }
}
