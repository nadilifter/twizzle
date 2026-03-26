// Types for the Program Calendar component

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date string
  startTime: string; // e.g., "09:00"
  endTime: string; // e.g., "10:30"
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  programId: string;
  programName: string;
  facilityId: string | null;
  facilityName: string | null;
  capacity: number | null;
  registrationCount: number;
  attendanceCount: number;
  color: string; // Hex color from program level
  levelName: string | null;
  registrationType: string | null;
  isSoldOut: boolean;
  isWaitlistAvailable: boolean;
  hasAgeRestriction?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  hasLevelRestriction?: boolean;
  levelIds?: string[];
  coachIds?: string[];
  seasonId?: string | null;
  categoryId?: string | null;
}

export type ViewMode = "month" | "week" | "day";

export interface ProgramCalendarProps {
  initialDate?: Date;
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
  showHeader?: boolean;
  /** When provided, fetches from the public API using this site slug instead of the auth-protected endpoint */
  slug?: string;
  /** When true, hides sensitive data like registration counts and attendance in the UI */
  isPublic?: boolean;
  /** Optional predicate to filter visible events (applied after date-range filtering) */
  eventFilter?: (event: CalendarEvent) => boolean;
  /** Optional transform applied to each event before rendering (e.g. to override colors) */
  eventTransform?: (event: CalendarEvent) => CalendarEvent;
}

export interface CalendarContextType {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  events: CalendarEvent[];
  loading: boolean;
  onEventClick: (event: CalendarEvent) => void;
  /** Whether the calendar is in public mode (hides sensitive data) */
  isPublic: boolean;
}
