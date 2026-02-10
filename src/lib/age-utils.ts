/**
 * Calculate age in years from a birth date.
 * Returns null if birthDate is falsy.
 */
export function calculateAge(birthDate: Date | string | null): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Check whether a given age satisfies a program's age restriction.
 */
export function isAgeEligible(
  age: number | null,
  minAge: number | null | undefined,
  maxAge: number | null | undefined
): boolean {
  if (age === null) return true; // no birthDate = can't verify, allow through
  if (minAge != null && age < minAge) return false;
  if (maxAge != null && age > maxAge) return false;
  return true;
}
