// Types for Attendance API

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

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
    avatar: string | null;
  };
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  };
}

// API Response types
export interface AttendanceListResponse {
  data: AttendanceWithRelations[];
  total: number;
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
  startDate?: string;
  endDate?: string;
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
