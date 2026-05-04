export type MediaType = "IMAGE" | "VIDEO";

export interface Media {
  id: string;
  url: string;
  type: MediaType;
  title: string | null;
  description: string | null;
  athleteId: string | null;
  eventId: string | null;
  uploadedById: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaWithRelations extends Media {
  athlete?: { id: string; firstName: string; lastName: string } | null;
  event?: { id: string; title: string } | null;
  uploadedBy: { id: string; name: string };
}

export interface CreateMediaPayload {
  url: string;
  type: MediaType;
  title?: string;
  description?: string;
  athleteId?: string;
  eventId?: string;
}

export interface UpdateMediaPayload {
  title?: string;
  description?: string;
  athleteId?: string | null;
  eventId?: string | null;
}

export interface MediaQueryParams {
  athleteId?: string;
  eventId?: string;
  uploadedById?: string;
  type?: MediaType;
  limit?: number;
  offset?: number;
}
