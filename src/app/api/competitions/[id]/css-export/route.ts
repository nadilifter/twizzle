import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCssExport, serializeCssCsv, suggestedCssFilename } from "@/lib/css-export";
import { fetchCssExportInput } from "./shared";

// Allowlisted in scripts/tenant-isolation-allowlist.txt — every query in this
// route is filtered by organizationId from the authenticated session.

/**
 * GET /api/competitions/[id]/css-export
 *
 * Streams a Skate Canada CSS-compatible CSV of valid competition entries.
 * Use /css-export/validate first to surface blocked entries to the user;
 * this endpoint silently skips them.
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
    const csv = serializeCssCsv(result);
    const filename = suggestedCssFilename(input.competition);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-CSS-Export-Rows": String(result.rows.length),
        "X-CSS-Export-Blocked": String(result.blocked.length),
      },
    });
  } catch (err) {
    console.error("CSS export error:", err);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}
