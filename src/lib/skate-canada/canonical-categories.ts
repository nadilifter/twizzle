// Canonical Skate Canada category names.
//
// Mirrors the PHP `SkateCanadaApi::skateCanadaCategories()` list. These are
// the only category names SC will accept when submitting a registration; any
// local Twizzle category name that's NOT in this list will be rejected by
// the CRM at submission time. Phase 6.5's "drift detection" is a static
// check — compare local names against this list and surface the diff so an
// admin can rename them BEFORE a submission fails.
//
// If SC adds or renames a category, update this constant. There is no live
// CRM endpoint exposing the canonical list (per the PHP reference).

export const SKATE_CANADA_CANONICAL_CATEGORIES = [
  "CanSkate",
  "STARSkate",
  "PodiumPathway",
  "CanPowerSkate",
  "Executive",
  "Official",
  "Program Assistants",
  "N/A",
] as const;

export type SkateCanadaCanonicalCategory = (typeof SKATE_CANADA_CANONICAL_CATEGORIES)[number];

const CANONICAL_SET = new Set<string>(SKATE_CANADA_CANONICAL_CATEGORIES);

/**
 * True when the given name exactly matches a canonical SC category (case-
 * sensitive). Twizzle compares trimmed strings — leading/trailing whitespace
 * is the caller's problem to handle.
 */
export function isCanonicalSkateCanadaCategory(name: string): boolean {
  return CANONICAL_SET.has(name);
}

/**
 * Returns the subset of `names` that are NOT in the canonical list. Useful
 * for surfacing drift in admin UI: `findDriftedCategories(allLocalNames)`
 * returns the ones an admin needs to rename before submitting to SC.
 */
export function findDriftedCategories(names: readonly string[]): string[] {
  return names.filter((n) => !CANONICAL_SET.has(n));
}
