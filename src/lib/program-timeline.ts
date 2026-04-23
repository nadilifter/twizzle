import { format, isPast } from "date-fns";
import type { TimelineItem } from "@/components/registration-timeline";

export interface ProgramTimelineInput {
  createdAt: string | Date;
  registrationStartDate?: string | Date | null;
  registrationStartTime?: string | null;
  registrationEndDate?: string | Date | null;
  registrationEndTime?: string | null;
  startDate?: string | Date | null;
  startTime?: string | null;
  endDate?: string | Date | null;
}

export function buildProgramTimelineItems(program: ProgramTimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];

  const created = new Date(program.createdAt);
  items.push({
    title: "Program Created",
    date: created,
    time: format(created, "h:mm a"),
    hollow: false,
  });

  if (program.registrationStartDate) {
    const d = new Date(program.registrationStartDate);
    items.push({
      title: "Registration Opens",
      date: d,
      time: program.registrationStartTime ?? null,
      hollow: !isPast(d),
    });
  }

  if (program.registrationEndDate) {
    const d = new Date(program.registrationEndDate);
    items.push({
      title: "Registration Closes",
      date: d,
      time: program.registrationEndTime ?? null,
      hollow: !isPast(d),
    });
  }

  if (program.startDate) {
    const d = new Date(program.startDate);
    items.push({
      title: "Program Begins",
      date: d,
      time: program.startTime ?? null,
      hollow: !isPast(d),
    });
  }

  if (program.endDate) {
    const d = new Date(program.endDate);
    items.push({
      title: "Program Ends",
      date: d,
      time: null,
      hollow: !isPast(d),
    });
  }

  return items;
}
