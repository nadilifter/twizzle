import { athleteDisplayName } from "@/lib/athlete-name";
/**
 * Pure helpers for rolling up InstanceAttendance records into
 * per-athlete and per-session summaries. Kept free of Prisma / network
 * calls so they can be unit-tested in isolation.
 */

export type AttendanceStatus = "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceInput {
  athleteId: string;
  programInstanceId: string;
  status: string;
  athlete: { id: string; firstName: string; lastName: string; avatar: string | null };
  programInstance: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    status: string;
  };
}

export interface AthleteAttendanceSummary {
  athleteId: string;
  name: string | null;
  avatar: string | null;
  present: number;
  absent: number;
  late: number;
  excused: number;
  registered: number;
  total: number;
  percentage: number;
}

export interface SessionAttendanceSummary {
  instanceId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  registered: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
}

function bumpCounter(
  row: { present: number; absent: number; late: number; excused: number; registered: number },
  status: string
): void {
  switch (status as AttendanceStatus) {
    case "PRESENT":
      row.present += 1;
      break;
    case "ABSENT":
      row.absent += 1;
      break;
    case "LATE":
      row.late += 1;
      break;
    case "EXCUSED":
      row.excused += 1;
      break;
    case "REGISTERED":
      row.registered += 1;
      break;
  }
}

/**
 * Percentage attended = (present + late) / (total - excused).
 * Excused sessions are neutral and don't penalize the athlete's rate.
 * Returns 0 when there is nothing to measure.
 */
function attendanceRate(row: {
  present: number;
  late: number;
  excused: number;
  total: number;
}): number {
  const denom = row.total - row.excused;
  if (denom <= 0) return 0;
  return Math.round(((row.present + row.late) / denom) * 100);
}

export function summarizeAttendanceByAthlete(
  attendances: AttendanceInput[]
): AthleteAttendanceSummary[] {
  const byAthlete = new Map<string, AthleteAttendanceSummary>();
  for (const a of attendances) {
    let row = byAthlete.get(a.athleteId);
    if (!row) {
      row = {
        athleteId: a.athleteId,
        name: athleteDisplayName(a.athlete) || null,
        avatar: a.athlete.avatar,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        registered: 0,
        total: 0,
        percentage: 0,
      };
      byAthlete.set(a.athleteId, row);
    }
    bumpCounter(row, a.status);
    row.total += 1;
  }
  const rows = Array.from(byAthlete.values()).map((r) => ({
    ...r,
    percentage: attendanceRate(r),
  }));
  rows.sort((x, y) => (x.name ?? "").localeCompare(y.name ?? ""));
  return rows;
}

export function summarizeAttendanceBySession(
  attendances: AttendanceInput[]
): SessionAttendanceSummary[] {
  const bySession = new Map<string, SessionAttendanceSummary>();
  for (const a of attendances) {
    let row = bySession.get(a.programInstanceId);
    if (!row) {
      row = {
        instanceId: a.programInstanceId,
        date: a.programInstance.date.toISOString(),
        startTime: a.programInstance.startTime,
        endTime: a.programInstance.endTime,
        status: a.programInstance.status,
        registered: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      };
      bySession.set(a.programInstanceId, row);
    }
    bumpCounter(row, a.status);
    row.total += 1;
  }
  return Array.from(bySession.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
