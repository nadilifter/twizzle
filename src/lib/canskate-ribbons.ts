/**
 * CanSkate ribbon metadata helpers.
 *
 * These pure-functions classify EvaluationTemplate / Achievement rows that
 * came from the CanSkate ribbon catalog (seeded via prisma/canskate-ribbons.ts).
 * They run in both server and client code (no Prisma dependency).
 */

export type CanSkateRibbonDimension = "Balance" | "Control" | "Agility" | "Achievement";

export interface CanSkateRibbonMeta {
  /** True when this template/achievement is a CanSkate ribbon. */
  isRibbon: true;
  /** CanSkate stage 1-6, or 0 for Pre-CanSkate. */
  stage: number;
  /** Ribbon dimension. */
  dimension: CanSkateRibbonDimension;
  /** Human label: "CanSkate 2 — Balance" / "Pre-CanSkate". */
  label: string;
  /** Short label for tight badges: "CS2 Balance" / "Pre-CS". */
  shortLabel: string;
}

/** ID prefixes used by the canskate ribbon seeder. */
const TEMPLATE_PREFIX = "-canskate-tmpl-";
const ACHIEVEMENT_PREFIX = "-canskate-ach-";

/**
 * Parse ribbon stage + dimension from the canonical Achievement / Template
 * name format used by the seeder. Returns null if the input doesn't look
 * like a ribbon.
 *
 * Examples:
 *   "CanSkate 3 - Balance Ribbon"          → { stage: 3, dimension: "Balance" }
 *   "CanSkate 3 - Balance Test Sheet"      → { stage: 3, dimension: "Balance" }
 *   "Pre-CanSkate Achievement"             → { stage: 0, dimension: "Achievement" }
 *   "Pre-CanSkate Test Sheet"              → { stage: 0, dimension: "Achievement" }
 */
function parseRibbonFromName(name: string | null | undefined): {
  stage: number;
  dimension: CanSkateRibbonDimension;
} | null {
  if (!name) return null;
  const stageMatch = name.match(/CanSkate\s+(\d)\s*-\s*(Balance|Control|Agility)/i);
  if (stageMatch) {
    const stage = parseInt(stageMatch[1], 10);
    const dim = stageMatch[2];
    const dimension = (dim.charAt(0).toUpperCase() + dim.slice(1).toLowerCase()) as
      | "Balance"
      | "Control"
      | "Agility";
    return { stage, dimension };
  }
  if (/Pre-CanSkate/i.test(name)) {
    return { stage: 0, dimension: "Achievement" };
  }
  return null;
}

/**
 * Classify an EvaluationTemplate or Achievement row as a CanSkate ribbon.
 * Returns null if it's not a ribbon — callers can treat that as "regular
 * evaluation template".
 */
export function getCanSkateRibbonMeta(input: {
  id?: string | null;
  name?: string | null;
}): CanSkateRibbonMeta | null {
  // Fast path: deterministic ID prefix from the seeder
  const id = input.id ?? "";
  const isSeededRibbon = id.includes(TEMPLATE_PREFIX) || id.includes(ACHIEVEMENT_PREFIX);
  // Slow path: name match. Lets newer DBs that don't use the prefix still classify.
  const parsed = parseRibbonFromName(input.name);
  if (!isSeededRibbon && !parsed) return null;
  const { stage, dimension } = parsed ?? { stage: 0, dimension: "Achievement" };

  const label = stage === 0 ? "Pre-CanSkate" : `CanSkate ${stage} — ${dimension}`;
  const shortLabel = stage === 0 ? "Pre-CS" : `CS${stage} ${dimension}`;

  return {
    isRibbon: true,
    stage,
    dimension,
    label,
    shortLabel,
  };
}

/**
 * Tailwind class fragments for ribbon dimension colors. Used by badges,
 * banners, and the test sheet header to mirror Skate Canada's official
 * ribbon colours (Balance=blue, Control=green, Agility=red).
 */
export const RIBBON_DIMENSION_STYLE: Record<
  CanSkateRibbonDimension,
  { badge: string; banner: string; dot: string }
> = {
  Balance: {
    badge: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-200",
    banner:
      "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100",
    dot: "bg-blue-500",
  },
  Control: {
    badge:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200",
    banner:
      "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100",
    dot: "bg-emerald-500",
  },
  Agility: {
    badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200",
    banner:
      "bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-100",
    dot: "bg-rose-500",
  },
  Achievement: {
    badge: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-200",
    banner:
      "bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-100",
    dot: "bg-slate-400",
  },
};
