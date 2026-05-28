/**
 * CanSkate Ribbon Catalog Seed
 * ============================
 *
 * Ports the official Skate Canada CanSkate badge/ribbon catalog into Twizzle.
 * Each CanSkate stage (1-6) awards three coloured ribbons: Balance, Control,
 * and Agility. Pre-CanSkate is a single introductory tier with no ribbons.
 *
 * For each ribbon we create:
 *   - One EvaluationTemplate (the "test sheet")
 *   - One Achievement linked to that template (the ribbon itself)
 *   - The full list of goals as Skills, linked via EvaluationTemplateSkill
 *     with isRequired = true
 *
 * Auto-award already happens through src/lib/services/achievement.ts:
 *   checkAndAwardAchievements() is called by the evaluation API on save.
 *
 * Source data: prisma/canskate-ribbons/*.csv — ported verbatim from
 * the Uplifter ecosystem.
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RIBBONS_DIR = join(__dirname, "canskate-ribbons");

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

interface CsvRow {
  goalEng: string;
  goalFre: string;
  achievementTag: string; // e.g. "CanSkate 1 - Balance"; empty for Pre-CanSkate
  categoryLevelName: string; // e.g. "CanSkate 1" or "Pre-CanSkate"
}

/**
 * Minimal CSV parser. Handles double-quoted fields with embedded commas and
 * escaped quotes (`""`). The Uplifter CSVs are well-formed but use heavy
 * padding inside cells, so we trim every value.
 */
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      // End of line — but skip empty trailing rows
      if (ch === "\r" && content[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim().length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }

    cell += ch;
    i++;
  }

  // Flush final cell/row
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim().length > 0)) rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

function loadCsv(filename: string): CsvRow[] {
  const path = join(RIBBONS_DIR, filename);
  const raw = readFileSync(path, "utf-8");
  const rows = parseCsv(raw);
  // First row is header
  return rows.slice(1).map((cols) => ({
    goalEng: cols[0] ?? "",
    goalFre: cols[1] ?? "",
    achievementTag: cols[6] ?? "",
    categoryLevelName: cols[8] ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Catalog building
// ---------------------------------------------------------------------------

interface RibbonDef {
  /** Stable key inside an organization, used to build deterministic IDs. */
  key: string;
  /** Display name shown on the badge ("CanSkate 1 - Balance Ribbon"). */
  displayName: string;
  /** Short marketing description. */
  description: string;
  /** Linked CanSkate level name (matches names seeded by skate-seed.ts). */
  levelName: string;
  /** Stage number 1-6 (or 0 for Pre-CanSkate). */
  stage: number;
  /** Ribbon dimension: Balance / Control / Agility / Achievement. */
  dimension: string;
  /** Goals required to earn the ribbon (English names from the CSV). */
  goals: { eng: string; fre: string }[];
}

function buildCatalog(): RibbonDef[] {
  const sources: { file: string; dimension: string }[] = [
    { file: "balance.csv", dimension: "Balance" },
    { file: "control.csv", dimension: "Control" },
    { file: "agility.csv", dimension: "Agility" },
  ];

  // Build CanSkate 1-6 ribbons (3 per stage)
  const byKey = new Map<string, RibbonDef>();
  for (const src of sources) {
    const rows = loadCsv(src.file);
    for (const r of rows) {
      // achievement_tag looks like "CanSkate 1 - Balance"
      const match = r.achievementTag.match(/CanSkate\s+(\d)\s*-\s*(\w+)/i);
      if (!match) continue;
      const stage = parseInt(match[1], 10);
      const dimension = src.dimension;
      const key = `canskate-stage-${stage}-${dimension.toLowerCase()}`;

      let def = byKey.get(key);
      if (!def) {
        def = {
          key,
          displayName: `CanSkate ${stage} - ${dimension} Ribbon`,
          description: `Skate Canada CanSkate Stage ${stage} ${dimension} ribbon — earned by passing every required goal on the official ${dimension.toLowerCase()} test sheet.`,
          levelName: `CanSkate Stage ${stage}`,
          stage,
          dimension,
          goals: [],
        };
        byKey.set(key, def);
      }
      // Avoid pushing duplicate goals (a few rows duplicate within a stage)
      if (!def.goals.some((g) => g.eng === r.goalEng)) {
        def.goals.push({ eng: r.goalEng, fre: r.goalFre });
      }
    }
  }

  // Pre-CanSkate (single ribbon, no Balance/Control/Agility split)
  const pre = loadCsv("pre-canskate.csv");
  if (pre.length > 0) {
    const preDef: RibbonDef = {
      key: "pre-canskate-achievement",
      displayName: "Pre-CanSkate Achievement",
      description:
        "Introductory tier for first-time skaters: ice familiarity, falling and getting up, basic forward and backward movement.",
      levelName: "Pre-CanSkate",
      stage: 0,
      dimension: "Achievement",
      goals: pre.map((r) => ({ eng: r.goalEng, fre: r.goalFre })),
    };
    byKey.set(preDef.key, preDef);
  }

  // Stable ordering: Pre-CanSkate first, then by stage, then dimension
  const dimensionOrder: Record<string, number> = {
    Balance: 0,
    Control: 1,
    Agility: 2,
    Achievement: 0,
  };
  return Array.from(byKey.values()).sort((a, b) => {
    if (a.stage !== b.stage) return a.stage - b.stage;
    return (dimensionOrder[a.dimension] ?? 99) - (dimensionOrder[b.dimension] ?? 99);
  });
}

// ---------------------------------------------------------------------------
// Pre-CanSkate level helper
// ---------------------------------------------------------------------------

async function ensurePreCanSkateLevel(prisma: PrismaClient, organizationId: string): Promise<void> {
  const id = `${organizationId}-level-pre-canskate`;
  await prisma.level.upsert({
    where: { id },
    update: {},
    create: {
      id,
      organizationId,
      name: "Pre-CanSkate",
      description: "Introductory tier for first-time skaters before CanSkate Stage 1.",
      order: 0,
      color: "#94a3b8",
    },
  });
}

// ---------------------------------------------------------------------------
// Seeder
// ---------------------------------------------------------------------------

export interface CanSkateRibbonSeedResult {
  skillsCreated: number;
  ribbonsCreated: number;
  templateSkillLinks: number;
}

export async function seedCanSkateRibbons(
  prisma: PrismaClient,
  organizationId: string
): Promise<CanSkateRibbonSeedResult> {
  await ensurePreCanSkateLevel(prisma, organizationId);

  const catalog = buildCatalog();

  // Map level name → level id for this org (used for template.levelId)
  const levels = await prisma.level.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  });
  const levelByName = new Map(levels.map((l) => [l.name, l.id]));

  // ---- 1. Skills (deduped by name within the org) ----
  const uniqueSkillNames = new Set<string>();
  for (const ribbon of catalog) {
    for (const goal of ribbon.goals) uniqueSkillNames.add(goal.eng);
  }

  // Look up any existing Skill rows by name to dedupe across runs
  const existingSkills = await prisma.skill.findMany({
    where: { organizationId, name: { in: Array.from(uniqueSkillNames) } },
    select: { id: true, name: true },
  });
  const skillIdByName = new Map(existingSkills.map((s) => [s.name, s.id]));

  // Create any missing skills
  let skillsCreated = 0;
  for (const name of uniqueSkillNames) {
    if (skillIdByName.has(name)) continue;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const id = `${organizationId}-canskate-skill-${slug}`;
    const created = await prisma.skill.create({
      data: {
        id,
        organizationId,
        name,
        category: "CanSkate", // Element-type bucket for this catalog
        description: null,
      },
    });
    skillIdByName.set(name, created.id);
    skillsCreated++;
  }

  // ---- 2. EvaluationTemplate + Achievement + EvaluationTemplateSkill per ribbon ----
  let ribbonsCreated = 0;
  let templateSkillLinks = 0;

  for (const ribbon of catalog) {
    const levelId = levelByName.get(ribbon.levelName) ?? null;
    const templateId = `${organizationId}-canskate-tmpl-${ribbon.key}`;
    const achievementId = `${organizationId}-canskate-ach-${ribbon.key}`;

    // Template (test sheet): all required, completion = ALL
    const skillIdsInOrder = ribbon.goals
      .map((g) => skillIdByName.get(g.eng))
      .filter((id): id is string => Boolean(id));

    // Upsert template (recreate the skill links if it didn't exist before)
    const existing = await prisma.evaluationTemplate.findUnique({
      where: { id: templateId },
      select: { id: true },
    });

    if (!existing) {
      await prisma.evaluationTemplate.create({
        data: {
          id: templateId,
          organizationId,
          name: `${ribbon.displayName.replace(" Ribbon", "")} Test Sheet`,
          description: ribbon.description,
          levelId,
          minAge: null,
          maxAge: null,
          scoringType: "PASS_FAIL",
          pointScaleMin: 1,
          pointScaleMax: 10,
          pointScalePassThreshold: 7,
          completionType: "ALL",
          completionThreshold: 100,
          autoSyncEnabled: false,
          autoSyncLevels: [],
          autoSyncCategories: [],
          skills: {
            create: skillIdsInOrder.map((skillId, index) => ({
              skillId,
              order: index,
              isRequired: true,
            })),
          },
        },
      });
      templateSkillLinks += skillIdsInOrder.length;
    }

    // Achievement (the ribbon itself)
    await prisma.achievement.upsert({
      where: { id: achievementId },
      update: {},
      create: {
        id: achievementId,
        organizationId,
        templateId,
        name: ribbon.displayName,
        description: ribbon.description,
      },
    });
    ribbonsCreated++;
  }

  return {
    skillsCreated,
    ribbonsCreated,
    templateSkillLinks,
  };
}

// Export catalog shape for use by UI layers that want to render ribbons
// without round-tripping through the DB (e.g. legend, color hints).
export const CANSKATE_RIBBON_DIMENSIONS = ["Balance", "Control", "Agility"] as const;
export type CanSkateRibbonDimension = (typeof CANSKATE_RIBBON_DIMENSIONS)[number];
