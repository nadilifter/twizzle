"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";
import type {
  EventWithRelations,
  EventsListResponse,
  EventsQueryParams,
} from "@/types/events";

interface UseCoachEventsOptions {
  autoFetch?: boolean;
  initialParams?: Omit<EventsQueryParams, "coachId">;
}

interface UseCoachEventsReturn {
  events: EventWithRelations[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchEvents: (params?: Omit<EventsQueryParams, "coachId">) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for fetching events assigned to the current coach.
 * Automatically filters by the logged-in user's ID as coachId.
 * Supports superadmin impersonation via "view as coach" feature.
 */
export function useCoachEvents(options: UseCoachEventsOptions = {}): UseCoachEventsReturn {
  const { autoFetch = true, initialParams = {} } = options;
  const { data: session } = useSession();
  
  // Get effective coach ID (use impersonated ID if superadmin is viewing as coach)
  const effectiveCoachId = useMemo(() => {
    if (!session?.user) return null;
    // If superadmin is impersonating a coach, use the impersonated coach's ID
    if (session.user.isSuperAdmin && session.user.viewingAsCoachId) {
      return session.user.viewingAsCoachId;
    }
    return session.user.id;
  }, [session?.user]);

  const [events, setEvents] = useState<EventWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParamsState] = useState<Omit<EventsQueryParams, "coachId">>(initialParams);
  const currentParamsRef = useRef<Omit<EventsQueryParams, "coachId">>(initialParams);

  const setCurrentParams = useCallback((params: Omit<EventsQueryParams, "coachId">) => {
    currentParamsRef.current = params;
    setCurrentParamsState(params);
  }, []);

  const fetchEvents = useCallback(async (params?: Omit<EventsQueryParams, "coachId">) => {
    if (!effectiveCoachId) {
      setError("Not authenticated");
      return;
    }

    const queryParams = params ?? currentParamsRef.current;
    
    if (JSON.stringify(queryParams) !== JSON.stringify(currentParamsRef.current)) {
      setCurrentParams(queryParams);
    }
    currentParamsRef.current = queryParams;

    setIsLoading(true);
    setError(null);

    try {
      // Add coachId to filter by current user (or impersonated coach)
      const response = await api.get<EventsListResponse>("/api/events", {
        ...queryParams,
        coachId: effectiveCoachId,
      });
      setEvents(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch events";
      setError(message);
      console.error("Error fetching coach events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveCoachId, setCurrentParams]);

  const refresh = useCallback(async () => {
    await fetchEvents(currentParams);
  }, [fetchEvents, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch && effectiveCoachId) {
      fetchEvents(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCoachId]);

  return {
    events,
    total,
    isLoading,
    error,
    fetchEvents,
    refresh,
    clearError,
  };
}

/**
 * Hook for fetching today's events for the coach.
 * Useful for attendance marking.
 */
export function useCoachTodayEvents() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return useCoachEvents({
    initialParams: {
      startDate: startOfDay.toISOString().split("T")[0],
      endDate: endOfDay.toISOString().split("T")[0],
    },
  });
}
