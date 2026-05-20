"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";

interface CoachAthlete {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  level: string;
  group: string;
  status: string;
  avatar: string | null;
  programs: {
    id: string;
    name: string;
    level: string;
  }[];
}

interface CoachAthletesResponse {
  data: CoachAthlete[];
  total: number;
  limit: number;
  offset: number;
}

interface UseCoachAthletesOptions {
  autoFetch?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

interface UseCoachAthletesReturn {
  athletes: CoachAthlete[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchAthletes: (params?: { search?: string; limit?: number; offset?: number }) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: CoachAthlete[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: { search?: string; limit?: number; offset?: number }): string {
  return JSON.stringify(params ?? {});
}

/**
 * Hook for fetching athletes from events assigned to the current coach.
 * Returns athletes enrolled in programs where the coach has assigned events.
 */
export function useCoachAthletes(options: UseCoachAthletesOptions = {}): UseCoachAthletesReturn {
  const { autoFetch = true, search = "", limit = 100, offset = 0 } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialParams = { search, limit, offset };
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [athletes, setAthletes] = useState<CoachAthlete[]>(() => initialCached?.data ?? []);
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const currentParamsRef = useRef<{ search?: string; limit?: number; offset?: number }>(
    initialParams
  );

  const fetchAthletes = useCallback(
    async (params?: { search?: string; limit?: number; offset?: number }) => {
      const queryParams = params ?? currentParamsRef.current;
      currentParamsRef.current = queryParams;

      const key = paramsKey(queryParams);
      const cached = listCache.get(key);
      if (!cached) setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<CoachAthletesResponse>("/api/coach/athletes", queryParams);
        setAthletes(response.data);
        setTotal(response.total);
        listCache.set(key, {
          data: response.data,
          total: response.total,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch athletes";
        setError(message);
        console.error("Error fetching coach athletes:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    await fetchAthletes(currentParamsRef.current);
  }, [fetchAthletes]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = paramsKey({ search, limit, offset });
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchAthletes({ search, limit, offset });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    athletes,
    total,
    isLoading,
    error,
    fetchAthletes,
    refresh,
    clearError,
  };
}
