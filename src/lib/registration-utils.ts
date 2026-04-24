import type { RegistrationWindowStatus } from "@/types/programs";

export type RegistrationStatus = "open" | "scheduled" | "closed";

// True when registration is not accepting sign-ups (closed or no window set yet)
export function isRegistrationClosed(status: RegistrationWindowStatus | null | undefined): boolean {
  return status === "CLOSED" || status == null;
}

interface RegistrationFields {
  registrationStatus?: string | null;
  registrationOpen?: boolean;
  registrationStartDate?: string | Date | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | Date | null;
  registrationEndTime?: string | null;
}

export function getRegistrationStatus(program: RegistrationFields): RegistrationStatus {
  // If the new registrationStatus field is set, use it directly.
  if (program.registrationStatus != null) {
    const s = program.registrationStatus.toUpperCase();
    if (s === "OPEN") return "open";
    if (s === "SCHEDULED") return "scheduled";
    if (s === "CLOSED") return "closed";
  }

  // Legacy fallback: derive status from boolean flags and date windows.
  const now = new Date();

  if (program.registrationEndDate) {
    const endDate = new Date(program.registrationEndDate);
    const endTime = program.registrationEndTime || "23:59";
    const [eh, em] = endTime.split(":").map(Number);
    endDate.setHours(eh, em, 59, 999);
    if (now > endDate) return "closed";
  }

  if (program.registrationOpen === false) {
    if (program.registrationStartDate) {
      const startDate = new Date(program.registrationStartDate);
      const startTime = program.registrationStartTime || "00:00";
      const [sh, sm] = startTime.split(":").map(Number);
      startDate.setHours(sh, sm, 0, 0);
      if (now < startDate) return "scheduled";
    } else {
      return "closed";
    }
  }

  return "open";
}
