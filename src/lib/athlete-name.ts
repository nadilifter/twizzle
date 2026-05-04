type AthleteNameParts = {
  firstName?: string | null;
  lastName?: string | null;
};

export function athleteDisplayName(athlete: AthleteNameParts): string {
  return `${athlete.firstName ?? ""} ${athlete.lastName ?? ""}`.trim();
}

export function athleteInitial(athlete: AthleteNameParts): string {
  const display = athleteDisplayName(athlete);
  return display.charAt(0).toUpperCase() || "?";
}
