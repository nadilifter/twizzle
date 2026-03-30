import { isPast } from "date-fns";

export interface CompetitionStatusFields {
  status: string;
  startDate: string;
  endDate: string;
  publishStatus?: string | null;
}

export const COMPETITION_TYPE_LABELS: Record<string, string> = {
  GYMNASTICS: "Gymnastics",
  TRACK_AND_FIELD: "Track & Field",
};

export const PUBLISH_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  CLOSED: "Closed",
  COMPLETED: "Completed",
};

export const FALLBACK_STATUS_LABELS: Record<string, string> = {
  REGISTRATION_OPEN: "Live",
  PUBLISHED: "Live",
  DRAFT: "Draft",
  REGISTRATION_CLOSED: "Closed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PUBLISH_STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100",
  DRAFT:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100",
  SCHEDULED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100",
  CLOSED:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100",
  COMPLETED:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100",
};

export const FALLBACK_STATUS_STYLES: Record<string, string> = {
  REGISTRATION_OPEN:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100",
  PUBLISHED:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100",
  DRAFT:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100",
  REGISTRATION_CLOSED:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100",
  IN_PROGRESS:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100",
  COMPLETED:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100",
  CANCELLED:
    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100",
};

const DEFAULT_STYLE =
  "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100";

export function getStatusLabel(competition: CompetitionStatusFields): string {
  if (competition.status === "CANCELLED") return "Cancelled";

  if (
    competition.publishStatus === "DRAFT" ||
    (!competition.publishStatus && competition.status === "DRAFT")
  ) {
    return "Draft";
  }

  if (competition.publishStatus === "SCHEDULED") return "Scheduled";

  const startDate = new Date(competition.startDate);
  const endDate = new Date(competition.endDate);

  if (isPast(endDate)) return "Completed";
  if (isPast(startDate)) return "Closed";

  if (competition.publishStatus && PUBLISH_STATUS_LABELS[competition.publishStatus]) {
    return PUBLISH_STATUS_LABELS[competition.publishStatus];
  }
  return FALLBACK_STATUS_LABELS[competition.status] || competition.status;
}

export function getStatusStyle(competition: CompetitionStatusFields): string {
  if (competition.status === "CANCELLED") return FALLBACK_STATUS_STYLES.CANCELLED;

  if (
    competition.publishStatus === "DRAFT" ||
    (!competition.publishStatus && competition.status === "DRAFT")
  ) {
    return PUBLISH_STATUS_STYLES.DRAFT;
  }

  if (competition.publishStatus === "SCHEDULED") return PUBLISH_STATUS_STYLES.SCHEDULED;

  const startDate = new Date(competition.startDate);
  const endDate = new Date(competition.endDate);

  if (isPast(endDate)) return PUBLISH_STATUS_STYLES.COMPLETED;
  if (isPast(startDate)) return PUBLISH_STATUS_STYLES.CLOSED;

  if (competition.publishStatus && PUBLISH_STATUS_STYLES[competition.publishStatus]) {
    return PUBLISH_STATUS_STYLES[competition.publishStatus];
  }
  return FALLBACK_STATUS_STYLES[competition.status] || DEFAULT_STYLE;
}
