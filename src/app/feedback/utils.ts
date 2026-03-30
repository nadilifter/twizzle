import { Status } from "./types";

export function getStatusVariant(
  status: Status | string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PLANNED":
      return "secondary";
    case "IN_PROGRESS":
      return "default";
    case "DONE":
      return "outline";
    case "CLOSED":
      return "destructive";
    default:
      return "secondary";
  }
}

export function formatStatus(status: Status | string): string {
  switch (status) {
    case "PLANNED":
      return "Planned";
    case "IN_PROGRESS":
      return "In Progress";
    case "DONE":
      return "Done";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

export function formatQuarter(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const quarter = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${quarter} ${d.getFullYear()}`;
}

export function getQuarterSortValue(date: string | null): number {
  if (!date) return Infinity;
  return new Date(date).getTime();
}
