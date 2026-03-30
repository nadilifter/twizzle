"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  Event,
  EventWithRelations,
  EventDetail,
  EventsListResponse,
  EventsQueryParams,
  CreateEventPayload,
  UpdateEventPayload,
} from "@/types/events";

interface UseEventsOptions {
  autoFetch?: boolean;
  initialParams?: EventsQueryParams;
}

interface UseEventsReturn {
  events: EventWithRelations[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchEvents: (params?: EventsQueryParams) => Promise<void>;
  createEvent: (data: CreateEventPayload) => Promise<EventWithRelations | null>;
  updateEvent: (id: string, data: UpdateEventPayload) => Promise<EventWithRelations | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useEvents(options: UseEventsOptions = {}): UseEventsReturn {
  const { autoFetch = true, initialParams = {} } = options;

  const [events, setEvents] = useState<EventWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParamsState] = useState<EventsQueryParams>(initialParams);
  const currentParamsRef = useRef<EventsQueryParams>(initialParams);

  const setCurrentParams = useCallback((params: EventsQueryParams) => {
    currentParamsRef.current = params;
    setCurrentParamsState(params);
  }, []);

  const fetchEvents = useCallback(
    async (params?: EventsQueryParams) => {
      const queryParams = params ?? currentParamsRef.current;

      if (JSON.stringify(queryParams) !== JSON.stringify(currentParamsRef.current)) {
        setCurrentParams(queryParams);
      }
      // Update ref regardless to ensure it's in sync for immediate reuse
      currentParamsRef.current = queryParams;

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<EventsListResponse>("/api/events", queryParams);
        setEvents(response.data);
        setTotal(response.total);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch events";
        setError(message);
        console.error("Error fetching events:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [setCurrentParams]
  );

  const createEvent = useCallback(
    async (data: CreateEventPayload): Promise<EventWithRelations | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newEvent = await api.post<EventWithRelations>("/api/events", data);
        setEvents((prev) => [...prev, newEvent]);
        setTotal((prev) => prev + 1);
        return newEvent;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create event";
        setError(message);
        console.error("Error creating event:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateEvent = useCallback(
    async (id: string, data: UpdateEventPayload): Promise<EventWithRelations | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedEvent = await api.patch<EventWithRelations>(`/api/events/${id}`, data);
        setEvents((prev) => prev.map((event) => (event.id === id ? updatedEvent : event)));
        return updatedEvent;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update event";
        setError(message);
        console.error("Error updating event:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteEvent = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/events/${id}`);
      setEvents((prev) => prev.filter((event) => event.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete event";
      setError(message);
      console.error("Error deleting event:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchEvents(currentParams);
  }, [fetchEvents, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchEvents(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    events,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    refresh,
    clearError,
  };
}

export function useEvent(id: string | null) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<EventDetail>(`/api/events/${id}`);
      setEvent(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch event";
      setError(message);
      console.error("Error fetching event:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return {
    event,
    isLoading,
    error,
    fetchEvent,
  };
}
