import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

const REQUIRED_HEADERS = ["athlete_id", "skill_name", "date_earned", "notes"] as const;

type CsvRow = {
  athlete_id: string;
  skill_name: string;
  date_earned: string;
  notes: string;
};

// POST /api/training/import-achievements
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

    // ADMIN-only
    const isSuperAdmin = session.user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      const membership = await db.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: session.user.id,
          },
        },
      });
      if (!membership || membership.role !== "ADMIN") {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const csvText = await file.text();

    const parsed = Papa.parse<CsvRow>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    // Validate headers
    const headers = parsed.meta.fields ?? [];
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: "CSV must have headers: athlete_id, skill_name, date_earned, notes" },
        { status: 400 }
      );
    }

    const rows = parsed.data;

    // Pre-fetch all org athletes (via OrganizationAthlete join)
    const orgAthletes = await db.organizationAthlete.findMany({
      where: { organizationId },
      select: { athleteId: true },
    });
    const validAthleteIds = new Set(orgAthletes.map((oa) => oa.athleteId));

    // Pre-fetch all org evaluation templates
    const templates = await db.evaluationTemplate.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    // Case-insensitive name → id map
    const templateByName = new Map(templates.map((t) => [t.name.trim().toLowerCase(), t.id]));

    type SkippedRow = { row: number; reason: string };
    const skipped: SkippedRow[] = [];
    const toCreate: {
      athleteId: string;
      coachId: string;
      templateId: string;
      date: Date;
      notes: string | null;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // 1-based + header row
      const row = rows[i];

      const athleteId = (row.athlete_id ?? "").trim();
      const skillName = (row.skill_name ?? "").trim().toLowerCase();
      const dateRaw = (row.date_earned ?? "").trim();
      const notes = (row.notes ?? "").trim() || null;

      if (!validAthleteIds.has(athleteId)) {
        skipped.push({ row: rowNum, reason: "athlete_not_found" });
        continue;
      }

      const templateId = templateByName.get(skillName);
      if (!templateId) {
        skipped.push({ row: rowNum, reason: "skill_not_found" });
        continue;
      }

      // Validate ISO date YYYY-MM-DD
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
        skipped.push({ row: rowNum, reason: "invalid_date" });
        continue;
      }
      const date = new Date(dateRaw + "T00:00:00.000Z");
      if (isNaN(date.getTime())) {
        skipped.push({ row: rowNum, reason: "invalid_date" });
        continue;
      }

      toCreate.push({ athleteId, coachId: session.user.id, templateId, date, notes });
    }

    let created = 0;
    if (toCreate.length > 0) {
      const results = await db.$transaction(
        toCreate.map((row) =>
          db.evaluation.create({
            data: {
              athleteId: row.athleteId,
              coachId: row.coachId,
              templateId: row.templateId,
              date: row.date,
              overallScore: 0,
              status: "PASS",
              notes: row.notes,
            },
          })
        )
      );
      created = results.length;
    }

    return NextResponse.json({
      created,
      skipped: skipped.slice(0, 10),
    });
  } catch (error) {
    console.error("Error importing achievements:", error);
    return NextResponse.json({ error: "Failed to import achievements" }, { status: 500 });
  }
}
