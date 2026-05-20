"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";
import type { EventWithRelations, EventsListResponse, EventsQueryParams } from "@/types/events";

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

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: EventWithRelations[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: Omit<EventsQueryParams, "coachId">): string {
  return JSON.stringify(params ?? {});
}

/**
 * Hook for fetching events assigned to the current coach across all coaching organizations.
 * Uses the dedicated coach events endpoint for multi-org support.
 */
export function useCoachEvents(options: UseCoachEventsOptions = {}): UseCoachEventsReturn {
  const { autoFetch = true, initialParams = {} } = options;
  const { data: session } = useSession();

  const effectiveCoachId = useMemo(() => {
    if (!session?.user) return null;
    if (session.user.isSuperAdmin && session.user.viewingAsUserId) {
      return session.user.viewingAsUserId;
    }
    return session.user.id;
  }, [session?.user]);

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [events, setEvents] = useState<EventWithRelations[]>(() => initialCached?.data ?? []);
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParamsState] =
    useState<Omit<EventsQueryParams, "coachId">>(initialParams);
  const currentParamsRef = useRef<Omit<EventsQueryParams, "coachId">>(initialParams);

  const setCurrentParams = useCallback((params: Omit<EventsQueryParams, "coachId">) => {
    currentParamsRef.current = params;
    setCurrentParamsState(params);
  }, []);

  const fetchEvents = useCallback(
    async (params?: Omit<EventsQueryParams, "coachId">) => {
      if (!effectiveCoachId) {
        setError("Not authenticated");
        return;
      }

      const queryParams = params ?? currentParamsRef.current;

      if (JSON.stringify(queryParams) !== JSON.stringify(currentParamsRef.current)) {
        setCurrentParams(queryParams);
      }
      currentParamsRef.current = queryParams;

      const key = paramsKey(queryParams);
      const cached = listCache.get(key);
      if (!cached) setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<EventsListResponse>("/api/coach/events", queryParams);
        setEvents(response.data);
        setTotal(response.total);
        listCache.set(key, {
          data: response.data,
          total: response.total,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch events";
        setError(message);
        console.error("Error fetching coach events:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [effectiveCoachId, setCurrentParams]
  );

  const refresh = useCallback(async () => {
    await fetchEvents(currentParams);
  }, [fetchEvents, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch || !effectiveCoachId) return;
    const key = paramsKey(initialParams);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchEvents(initialParams);
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
 * Hook for fetching today's events for the coach across all coaching orgs.
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
