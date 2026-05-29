// Shared search helpers for evaluation templates + levels.
//
// The TemplatePicker (used inside the New-evaluation flow) supports fuzzy
// shorthand matching via cmdk keywords — typing "cs3" matches the
// "CanSkate 3 — Balance" ribbon template because cmdk indexes the short
// label "CS3 Balance" as a keyword. The Evaluations page list and the
// Level dropdown in the create-template sheet needed the same affordance.
// These helpers centralize the keyword set so all three surfaces match
// the same vocabulary.

export interface LevelLike {
  name: string;
}

/**
 * Build search keywords for a Level row. Captures the literal name plus
 * common shorthand variants users actually type:
 *
 * - "CanSkate Stage 3" → "cs3", "csstage3", "stage3", "canskate3"
 * - "Pre-CanSkate"     → "precs", "pre-cs", "precanskate"
 * - "STAR 5"           → "star5", "s5"
 *
 * Always includes the lowercase name and a space-stripped variant for
 * pure substring matching as a baseline.
 */
export function levelSearchKeywords(name: string): string[] {
  const lower = name.toLowerCase();
  const stripped = lower.replace(/\s+/g, "");
  const keywords = new Set<string>([lower, stripped]);

  // "CanSkate Stage N"
  const cs = name.match(/^canskate\s+stage\s+(\d+)/i);
  if (cs) {
    const n = cs[1];
    keywords.add(`cs${n}`);
    keywords.add(`csstage${n}`);
    keywords.add(`stage${n}`);
    keywords.add(`canskate${n}`);
  }

  // "Pre-CanSkate"
  if (/pre[-\s]?canskate/i.test(name)) {
    keywords.add("precs");
    keywords.add("pre-cs");
    keywords.add("precanskate");
  }

  // "STAR N" (and variants like "STAR 5 Freeskate")
  const star = name.match(/^star\s+(\d+)/i);
  if (star) {
    const n = star[1];
    keywords.add(`star${n}`);
    keywords.add(`s${n}`);
  }

  return [...keywords];
}

/**
 * Build search keywords for an EvaluationTemplate. Covers ribbon-meta
 * shorthand (CS3 Balance), STAR-N patterns derived from the template
 * name, and the description text. Designed to be used as the haystack
 * for an AND-tokenized substring filter (same logic as the
 * TemplatePicker combobox).
 */
export interface TemplateLike {
  name: string;
  description?: string | null;
  ribbonMeta?: {
    stage: number;
    label: string;
    shortLabel: string;
    dimension: string;
  } | null;
}

export function templateSearchKeywords(template: TemplateLike): string[] {
  const keywords = new Set<string>();
  keywords.add(template.name.toLowerCase());
  keywords.add(template.name.toLowerCase().replace(/\s+/g, ""));
  if (template.description) keywords.add(template.description.toLowerCase());

  if (template.ribbonMeta) {
    const m = template.ribbonMeta;
    keywords.add(m.label.toLowerCase());
    keywords.add(m.shortLabel.toLowerCase());
    keywords.add(m.shortLabel.toLowerCase().replace(/\s+/g, ""));
    keywords.add(m.dimension.toLowerCase());
    keywords.add(`canskate ${m.stage}`);
    keywords.add(`canskate${m.stage}`);
    keywords.add(`cs${m.stage}`);
    keywords.add(`stage ${m.stage}`);
    keywords.add(`stage${m.stage}`);
    keywords.add("canskate");
    keywords.add("ribbon");
  } else {
    // STAR-pattern shorthand for non-ribbon templates.
    const star = template.name.match(/^star\s+(\d+)/i);
    if (star) {
      const n = star[1];
      keywords.add(`star${n}`);
      keywords.add(`s${n}`);
    }
  }

  return [...keywords];
}

/**
 * AND-tokenized substring match: every whitespace-separated token in the
 * query must appear somewhere in the keyword haystack. Empty query → match.
 *
 * Mirrors the filter callback inside TemplatePicker so all three surfaces
 * (page list, template picker, level dropdown) use the same matching
 * semantics.
 */
export function matchesQuery(keywords: string[], query: string): boolean {
  const needle = query.toLowerCase().trim();
  if (!needle) return true;
  const haystack = keywords.join(" ");
  const terms = needle.split(/\s+/).filter(Boolean);
  return terms.every((t) => haystack.includes(t));
}
