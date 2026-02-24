// Types for Events API - matches Prisma schema and API responses

export type EventType = "CLASS" | "CAMP" | "PARTY" | "COMPETITION" | "MEETING" | "OTHER";

export interface EventProgram {
  id: string;
  name: string;
  level: string;
}

export interface EventCoach {
  id: string;
  name: string;
  avatar: string | null;
}

export interface Event {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: EventType;
  description: string | null;
  meetingLink: string | null;
  timezone: string | null;
  capacity: number | null;
  location: {
    lat?: number;
    lng?: number;
    address?: string;
    name?: string;
  } | null;
  details: {
    whatToBring?: string[];
    whatToExpect?: string;
    requirements?: string;
  } | null;
  programId: string | null;
  coachId: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventWithRelations extends Event {
  program: EventProgram | null;
  coach: EventCoach | null;
  attendanceCount?: number;
  participants: string[];
}

export interface EventDetail extends EventWithRelations {
  attendances: {
    id: string;
    status: string;
    checkedIn: string | null;
    athlete: {
      id: string;
      name: string;
      avatar: string | null;
    };
  }[];
  requiredMemberships?: {
    id: string;
    name: string;
    group: {
      name: string;
    };
  }[];
}

// API Response types
export interface EventsListResponse {
  data: EventWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

// Request payload types
export interface CreateEventPayload {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type?: EventType;
  description?: string | null;
  meetingLink?: string | null;
  timezone?: string | null;
  capacity?: number | null;
  programId?: string | null;
  coachId?: string | null;
  requiredMembershipInstanceIds?: string[];
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
    name?: string;
  };
  details?: {
    whatToBring?: string[];
    whatToExpect?: string;
    requirements?: string;
  };
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {}

export interface EventsQueryParams {
  search?: string;
  type?: EventType;
  programId?: string;
  coachId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
