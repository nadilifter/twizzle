"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type { AttendanceMetricsResponse, AttendanceGroupBy } from "@/types/attendance";

interface UseAttendanceMetricsFilters {
  groupBy?: AttendanceGroupBy;
  athleteId?: string;
  programId?: string;
  coachId?: string;
  startDate?: string;
  endDate?: string;
}

interface UseAttendanceMetricsOptions {
  autoFetch?: boolean;
  initialFilters?: UseAttendanceMetricsFilters;
}

interface UseAttendanceMetricsReturn {
  metrics: AttendanceMetricsResponse | null;
  isLoading: boolean;
  error: string | null;
  fetchMetrics: (filters?: UseAttendanceMetricsFilters) => Promise<void>;
  refetch: () => Promise<void>;
}

// Module-level stale-while-revalidate cache keyed by serialized filters.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: AttendanceMetricsResponse;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(filters: UseAttendanceMetricsFilters): string {
  return JSON.stringify(filters ?? {});
}

export function useAttendanceMetrics(
  options: UseAttendanceMetricsOptions = {}
): UseAttendanceMetricsReturn {
  const { autoFetch = false, initialFilters = {} } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialFilters);
  const initialCached = listCache.get(initialKey);

  const [metrics, setMetrics] = useState<AttendanceMetricsResponse | null>(
    () => initialCached?.data ?? null
  );
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);
  // Use a ref instead of state to avoid re-creating fetchMetrics on filter changes
  const currentFiltersRef = useRef<UseAttendanceMetricsFilters>(initialFilters);

  const fetchMetrics = useCallback(async (filters?: UseAttendanceMetricsFilters) => {
    // Merge and store filters in ref (doesn't trigger re-render)
    const mergedFilters = { ...currentFiltersRef.current, ...filters };
    currentFiltersRef.current = mergedFilters;

    const key = paramsKey(mergedFilters);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      // Build query params, filtering out undefined/null values
      const queryParams = Object.fromEntries(
        Object.entries(mergedFilters).filter(([_, v]) => v !== undefined && v !== null && v !== "")
      );

      const response = await api.get<AttendanceMetricsResponse>(
        "/api/attendance/metrics",
        queryParams
      );
      setMetrics(response);
      listCache.set(key, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch attendance metrics";
      setError(message);
      console.error("Error fetching attendance metrics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchMetrics(currentFiltersRef.current);
  }, [fetchMetrics]);

  useEffect(() => {
    if (!autoFetch) return;
    const key = paramsKey(currentFiltersRef.current);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    metrics,
    isLoading,
    error,
    fetchMetrics,
    refetch,
  };
}

// Helper hook for specific groupings
export function useAttendanceMetricsByAthlete(
  athleteId?: string,
  options: Omit<UseAttendanceMetricsOptions, "initialFilters"> = {}
) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "athlete", athleteId },
  });
}

export function useAttendanceMetricsByProgram(
  programId?: string,
  options: Omit<UseAttendanceMetricsOptions, "initialFilters"> = {}
) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "program", programId },
  });
}

export function useAttendanceMetricsByCoach(
  coachId?: string,
  options: Omit<UseAttendanceMetricsOptions, "initialFilters"> = {}
) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "coach", coachId },
  });
}

export function useAttendanceMetricsByDate(
  startDate?: string,
  endDate?: string,
  options: Omit<UseAttendanceMetricsOptions, "initialFilters"> = {}
) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "date", startDate, endDate },
  });
}
