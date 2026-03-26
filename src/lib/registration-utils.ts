export type RegistrationStatus = "open" | "scheduled" | "closed";

interface RegistrationFields {
  registrationOpen?: boolean;
  registrationStartDate?: string | Date | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | Date | null;
  registrationEndTime?: string | null;
}

export function getRegistrationStatus(program: RegistrationFields): RegistrationStatus {
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
      return "scheduled";
    }
  }

  return "open";
}
