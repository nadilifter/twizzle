// Helper functions used when building Skate Canada CRM SOAP queries.
// Ported from SkateCanadaApi PHP. Each is the minimal version needed for
// the operations Twizzle calls — postal-code, fuzzy-match, and category
// helpers move here as later sub-phases need them.

// Skate Canada's CRM uses Dynamics' gendercode option-set field. Mapping
// from Twizzle's GenderDeclaration enum to SC's numeric values:
//   M   = 1     (Male)
//   F   = 2     (Female)
//   N-B = 947960000  (Non-binary — SC custom option)
//   DND = 947960001  (Decline / "Do Not Disclose")
const GENDER_CODE_MAP: Record<TwizzleGender, number> = {
  MALE: 1,
  FEMALE: 2,
  OTHER: 947960000,
  PREFER_NOT_TO_SAY: 947960001,
};

export type TwizzleGender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";

export function getGenderCode(gender: TwizzleGender): number {
  return GENDER_CODE_MAP[gender];
}

/**
 * XML-escape a value used inside an XML text node OR attribute (the union
 * of forbidden characters is the safe set). Also strips control characters
 * and broken UTF-16 surrogate halves, the same way the PHP htmlspecialchars
 * wrapper does (otherwise CRM rejects the request).
 */
export function escapeXml(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
  );
}

/**
 * Skate Canada stores birthdates with a noon-UTC timestamp; due to occasional
 * day/month swaps in their historical data, the original PHP query OR'd two
 * date ranges when the day-of-month is ≤ 12 (i.e. ambiguous with a month).
 *
 * Input: `YYYY-MM-DD` Twizzle birthdate string.
 * Output: a `<filter>` XML fragment ready to drop into a fetch query.
 */
export function buildBirthdateConditionXml(birthdate: string): string {
  const m = birthdate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new Error(`buildBirthdateConditionXml: expected YYYY-MM-DD, got ${birthdate}`);
  }
  const [, yyyy, mm, dd] = m;
  const day = Number(dd);
  const month = Number(mm);

  const dayBefore = (iso: string) => {
    const t = new Date(`${iso}T12:00:00Z`).getTime() - 24 * 60 * 60 * 1000;
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  };

  const baseFilter = (lo: string, hi: string) =>
    `<filter type="and"><condition attribute="birthdate" operator="ge" value="${lo}T12:00Z"/><condition attribute="birthdate" operator="le" value="${hi}T12:00Z"/></filter>`;

  const primary = baseFilter(dayBefore(birthdate), birthdate);

  // Only the ambiguous case (day ≤ 12 and day != month) gets the day/month-
  // flipped fallback. If the original date is "1990-07-15", day 15 can't be
  // a month so we skip the flip.
  if (day <= 12 && day !== month) {
    const flipped = `${yyyy}-${dd}-${mm}`;
    const flippedSecondary = baseFilter(dayBefore(flipped), flipped);
    return `<filter type="or">${flippedSecondary}${primary}</filter>`;
  }
  return primary;
}

/**
 * Case-insensitive, whitespace-trimmed equality for fuzzy name/etc.
 * matching when comparing local data to what SC returned.
 */
export function fuzzyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
