/**
 * Skate Canada CSS (Competition Software) Export
 * ==============================================
 *
 * Generates a CSV that figures-skating clubs upload to Skate Canada's CSS
 * tool to register competition entries. The format is modeled after
 * Uplifter's `programParticipantsSCCSS` report; we ship a minimum-viable
 * 14-column subset that covers everything CSS actually needs for entry
 * import. Optional columns can be added later without breaking format.
 *
 * The export is download-only — there is no API push to Skate Canada;
 * the user uploads the CSV manually in CSS.
 */

// ---------------------------------------------------------------------------
// Input types (server passes these in; this module is pure / no Prisma)
// ---------------------------------------------------------------------------

export interface CssExportAthlete {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY" | null;
  federationMemberNumber: string | null;
  federationMemberExpiresAt: Date | null;
  country: string | null;
}

export interface CssExportCategory {
  id: string;
  /** Discipline label, e.g. "Free Skate" / "Short Program" / "Moves in the Field". */
  disciplineName: string | null;
  /** Age category label, e.g. "Under 10" / "Open". */
  ageCategoryName: string | null;
  /** Optional code/slug used as EventCode when set. */
  code: string | null;
}

export interface CssExportEntry {
  id: string;
  status: string;
  athlete: CssExportAthlete;
  category: CssExportCategory;
}

export interface CssExportCompetition {
  id: string;
  name: string;
  startDate: Date;
}

export interface CssExportOrganization {
  name: string;
  /** Skate Canada section code (e.g. "ON"). Falls back to stateProvince. */
  federationSection: string | null;
  stateProvince: string | null;
  country: string | null;
}

export interface CssExportInput {
  competition: CssExportCompetition;
  organization: CssExportOrganization;
  entries: CssExportEntry[];
  /** Optional "as of" date — used for age calculation. Defaults to today. */
  asOf?: Date;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CssExportRow {
  EventCode: string;
  CatEventType: string;
  Category: string;
  Discipline: string;
  RegistNo: string;
  "First Name": string;
  "Last Name": string;
  Gender: string;
  Age: string;
  Birthdate: string;
  Club: string;
  "Section Representing": string;
  Country: string;
  EOR: string;
}

export interface CssExportBlockedEntry {
  entryId: string;
  athleteId: string;
  athleteName: string;
  reasons: string[];
}

export interface CssExportResult {
  /** Rows that passed validation and are included in the CSV. */
  rows: CssExportRow[];
  /** Entries that failed validation and were skipped. */
  blocked: CssExportBlockedEntry[];
  /** Header row in the same order as CssExportRow keys. */
  headers: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CSS_EXPORT_HEADERS: (keyof CssExportRow)[] = [
  "EventCode",
  "CatEventType",
  "Category",
  "Discipline",
  "RegistNo",
  "First Name",
  "Last Name",
  "Gender",
  "Age",
  "Birthdate",
  "Club",
  "Section Representing",
  "Country",
  "EOR",
];

const EXCLUDED_ENTRY_STATUSES = new Set(["WITHDRAWN", "SCRATCHED", "REJECTED", "CANCELLED"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBirthdate(d: Date): string {
  // Skate Canada expects MM/DD/YYYY in CSS imports.
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

function calculateAge(birthDate: Date, asOf: Date): number {
  let age = asOf.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = asOf.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && asOf.getUTCDate() < birthDate.getUTCDate())) age--;
  return age;
}

function mapGender(g: CssExportAthlete["gender"]): string {
  switch (g) {
    case "MALE":
      return "M";
    case "FEMALE":
      return "F";
    case "OTHER":
    case "PREFER_NOT_TO_SAY":
    case null:
    default:
      return "";
  }
}

function classifyDiscipline(name: string | null): string {
  // CSS expects one of Singles / Pairs / Dance / Synchro — but its entry
  // codes are mostly free-form so the program label works for most clubs.
  // Fall back to the raw label when present.
  return (name ?? "").trim();
}

function entryEventCode(entry: CssExportEntry): string {
  return (entry.category.code ?? entry.category.id.slice(-6).toUpperCase()).trim();
}

function resolveSection(org: CssExportOrganization): string {
  if (org.federationSection) return org.federationSection;
  // For Canadian Ontario sections, Uplifter rolls WO/EO/NO/CO into "ON".
  const sp = (org.stateProvince ?? "").trim().toUpperCase();
  if (["WO", "EO", "NO", "CO"].includes(sp)) return "ON";
  return sp;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateEntry(entry: CssExportEntry, asOf: Date): string[] {
  const reasons: string[] = [];
  const a = entry.athlete;
  if (EXCLUDED_ENTRY_STATUSES.has(entry.status)) {
    reasons.push(`Entry status is ${entry.status}`);
  }
  if (!a.federationMemberNumber) {
    reasons.push("Athlete has no federation member number");
  } else if (a.federationMemberExpiresAt && a.federationMemberExpiresAt < asOf) {
    reasons.push("Federation membership is expired");
  }
  if (!a.birthDate) {
    reasons.push("Athlete is missing a birth date");
  }
  if (!a.gender || a.gender === "OTHER" || a.gender === "PREFER_NOT_TO_SAY") {
    reasons.push("Athlete gender is not set or is non-binary (CSS requires M/F)");
  }
  if (!a.firstName.trim() || !a.lastName.trim()) {
    reasons.push("Athlete name is incomplete");
  }
  return reasons;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildCssExport(input: CssExportInput): CssExportResult {
  const asOf = input.asOf ?? new Date();
  const rows: CssExportRow[] = [];
  const blocked: CssExportBlockedEntry[] = [];

  const section = resolveSection(input.organization);
  const clubName = input.organization.name;

  for (const entry of input.entries) {
    const reasons = validateEntry(entry, asOf);
    const athleteName = `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim();

    if (reasons.length > 0) {
      blocked.push({
        entryId: entry.id,
        athleteId: entry.athlete.id,
        athleteName,
        reasons,
      });
      continue;
    }

    const birthDate = entry.athlete.birthDate as Date; // non-null after validation
    rows.push({
      EventCode: entryEventCode(entry),
      CatEventType: classifyDiscipline(entry.category.disciplineName),
      Category: entry.category.ageCategoryName ?? "",
      Discipline: classifyDiscipline(entry.category.disciplineName),
      RegistNo: entry.athlete.federationMemberNumber ?? "",
      "First Name": entry.athlete.firstName.trim(),
      "Last Name": entry.athlete.lastName.trim(),
      Gender: mapGender(entry.athlete.gender),
      Age: String(calculateAge(birthDate, asOf)),
      Birthdate: formatBirthdate(birthDate),
      Club: clubName,
      "Section Representing": section,
      Country: entry.athlete.country ?? input.organization.country ?? "",
      EOR: "X",
    });
  }

  return {
    rows,
    blocked,
    headers: CSS_EXPORT_HEADERS as string[],
  };
}

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  // Quote when the value contains comma, quote, or newline.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCssCsv(result: CssExportResult): string {
  const lines: string[] = [];
  lines.push(result.headers.map(csvEscape).join(","));
  for (const row of result.rows) {
    const indexed = row as unknown as Record<string, string>;
    lines.push(result.headers.map((h) => csvEscape(indexed[h] ?? "")).join(","));
  }
  // CSS examples ship as CRLF; many CSV consumers are tolerant of LF but the
  // CRLF convention avoids issues on Windows-imported files.
  return lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Filename helper
// ---------------------------------------------------------------------------

export function suggestedCssFilename(competition: CssExportCompetition): string {
  const date = competition.startDate.toISOString().slice(0, 10);
  const safeName = competition.name
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${safeName || "competition"}-css-${date}.csv`;
}
