import { Filter } from "bad-words";

let filter: Filter | null = null;

function getFilter(): Filter {
  if (!filter) {
    filter = new Filter();
  }
  return filter;
}

/**
 * Returns true if the text contains profanity.
 * Use for organization names (plain text) and subdomains (hyphens treated as word separators).
 */
export function containsProfanity(text: string): boolean {
  if (!text || !text.trim()) return false;
  const f = getFilter();
  // Check as-is (e.g. "My Bad Word Club")
  if (f.isProfane(text)) return true;
  // For subdomain-style input, treat hyphens as spaces so "bad-word-club" is checked as "bad word club"
  const withSpaces = text.trim().replace(/-/g, " ");
  if (withSpaces !== text && f.isProfane(withSpaces)) return true;
  return false;
}
