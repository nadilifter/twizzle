/**
 * Pure helpers for aggregating unique program athletes across enrollments and
 * per-session registrations, and for computing compliance flags.
 *
 * Kept free of Prisma / network calls so they can be unit-tested in isolation
 * and reused by both list and drill-in endpoints.
 */

export interface AthleteLite {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  email: string | null;
  birthDate: Date | null;
  gender: string | null;
  organizationAthletes?: { level: string | null }[];
}

export interface EnrollmentInput {
  athleteId: string;
  status: string;
  createdAt: Date;
  athlete: AthleteLite;
}

export interface InstanceRegistrationInput {
  athleteId: string;
  createdAt: Date;
  athlete: AthleteLite;
}

export interface AthleteRow {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  email: string | null;
  birthDate: Date | null;
  gender: string | null;
  level: { id: string; name: string } | null;
  sessionCount: number;
  status: string;
  firstRegisteredAt: string;
  compliance: Record<string, string>;
}

export function aggregateProgramAthletes(
  enrollments: EnrollmentInput[],
  instanceRegistrations: InstanceRegistrationInput[]
): Map<string, AthleteRow> {
  const byAthlete = new Map<string, AthleteRow>();

  for (const enr of enrollments) {
    const a = enr.athlete;
    const existing = byAthlete.get(a.id);
    const createdAtIso = enr.createdAt.toISOString();
    if (existing) {
      existing.status = enr.status;
      if (createdAtIso < existing.firstRegisteredAt) {
        existing.firstRegisteredAt = createdAtIso;
      }
    } else {
      byAthlete.set(a.id, {
        id: a.id,
        name: a.name,
        firstName: a.firstName,
        lastName: a.lastName,
        avatar: a.avatar,
        email: a.email,
        birthDate: a.birthDate,
        gender: a.gender,
        level: null,
        sessionCount: 0,
        status: enr.status,
        firstRegisteredAt: createdAtIso,
        compliance: {},
      });
    }
  }

  for (const reg of instanceRegistrations) {
    const a = reg.athlete;
    const existing = byAthlete.get(a.id);
    const createdAtIso = reg.createdAt.toISOString();
    if (existing) {
      existing.sessionCount += 1;
      if (createdAtIso < existing.firstRegisteredAt) {
        existing.firstRegisteredAt = createdAtIso;
      }
    } else {
      byAthlete.set(a.id, {
        id: a.id,
        name: a.name,
        firstName: a.firstName,
        lastName: a.lastName,
        avatar: a.avatar,
        email: a.email,
        birthDate: a.birthDate,
        gender: a.gender,
        level: null,
        sessionCount: 1,
        status: "REGISTERED",
        firstRegisteredAt: createdAtIso,
        compliance: {},
      });
    }
  }

  return byAthlete;
}

export function applyLevels(
  byAthlete: Map<string, AthleteRow>,
  enrollments: EnrollmentInput[],
  instanceRegistrations: InstanceRegistrationInput[],
  levelMap: Map<string, string>
): void {
  const assignFrom = (athleteId: string, lvl: string | null | undefined) => {
    const row = byAthlete.get(athleteId);
    if (!row || row.level) return;
    if (!lvl || lvl === "Unassigned") return;
    row.level = { id: lvl, name: levelMap.get(lvl) ?? lvl };
  };

  for (const enr of enrollments) {
    assignFrom(enr.athleteId, enr.athlete.organizationAthletes?.[0]?.level);
  }
  for (const reg of instanceRegistrations) {
    assignFrom(reg.athleteId, reg.athlete.organizationAthletes?.[0]?.level);
  }
}

export function applyMembershipCompliance(
  byAthlete: Map<string, AthleteRow>,
  athleteIdsWithMembership: Set<string>
): void {
  for (const [athleteId, row] of byAthlete) {
    row.compliance.membership = athleteIdsWithMembership.has(athleteId) ? "verified" : "missing";
  }
}

export function applyWaiverCompliance(
  byAthlete: Map<string, AthleteRow>,
  requiredWaiverIds: string[],
  acceptances: { athleteId: string | null; waiverId: string }[]
): void {
  const signedByAthlete = new Map<string, Set<string>>();
  for (const a of acceptances) {
    if (!a.athleteId) continue;
    const set = signedByAthlete.get(a.athleteId) ?? new Set();
    set.add(a.waiverId);
    signedByAthlete.set(a.athleteId, set);
  }
  for (const [athleteId, row] of byAthlete) {
    const signed = signedByAthlete.get(athleteId);
    const allSigned = signed ? requiredWaiverIds.every((w) => signed.has(w)) : false;
    row.compliance.waiver = allSigned ? "signed" : "unsigned";
  }
}

export function applyMedicalCompliance(
  byAthlete: Map<string, AthleteRow>,
  athleteIdsWithMedical: Set<string>
): void {
  for (const [athleteId, row] of byAthlete) {
    row.compliance.medical = athleteIdsWithMedical.has(athleteId) ? "complete" : "incomplete";
  }
}

export function sortAthleteRows(rows: AthleteRow[]): AthleteRow[] {
  return [...rows].sort((a, b) => {
    const aName = `${a.lastName ?? ""} ${a.firstName ?? a.name ?? ""}`.toLowerCase();
    const bName = `${b.lastName ?? ""} ${b.firstName ?? b.name ?? ""}`.toLowerCase();
    return aName.localeCompare(bName);
  });
}
