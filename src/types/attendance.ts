// Types for Attendance API

export type AttendanceStatus = "REGISTERED" | "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface Attendance {
  id: string;
  athleteId: string;
  eventId: string;
  status: AttendanceStatus;
  checkedIn: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceWithRelations extends Attendance {
  athlete: {
    id: string;
    name: string;
    avatar?: string | null;
    level?: string;
    family?: {
      id: string;
      name: string;
    };
  };
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    type?: string;
    program?: {
      id: string;
      name: string;
    } | null;
    coach?: {
      id: string;
      name: string;
    } | null;
  };
}

// API Response types
export interface AttendanceListResponse {
  data: AttendanceWithRelations[];
  total: number;
  limit?: number;
  offset?: number;
}

// Request payload types
export interface CreateAttendancePayload {
  athleteId: string;
  eventId: string;
  status: AttendanceStatus;
  notes?: string;
  checkedIn?: string | null;
}

export interface UpdateAttendancePayload {
  status?: AttendanceStatus;
  notes?: string;
  checkedIn?: string | null;
}

export interface AttendanceQueryParams {
  eventId?: string;
  athleteId?: string;
  programId?: string;
  coachId?: string;
  status?: AttendanceStatus;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// For bulk operations
export interface BulkAttendancePayload {
  eventId: string;
  records: {
    athleteId: string;
    status: AttendanceStatus;
    notes?: string;
    checkedIn?: string | null;
  }[];
}

// Metrics types
export interface AttendanceMetricsSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  registered: number;
  attendanceRate: number;
}

export interface AttendanceBreakdownItem {
  id: string;
  name: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  // Optional fields based on groupBy
  level?: string | null;
  email?: string | null;
  date?: string;
}

export interface AttendanceMetricsResponse {
  summary: AttendanceMetricsSummary;
  breakdown: AttendanceBreakdownItem[];
  filters: {
    groupBy: "overall" | "athlete" | "program" | "coach" | "date";
    athleteId?: string | null;
    programId?: string | null;
    coachId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
}

export type AttendanceGroupBy = "overall" | "athlete" | "program" | "coach" | "date";
