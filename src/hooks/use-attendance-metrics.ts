"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AttendanceMetricsResponse,
  AttendanceGroupBy,
} from "@/types/attendance";

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

export function useAttendanceMetrics(
  options: UseAttendanceMetricsOptions = {}
): UseAttendanceMetricsReturn {
  const { autoFetch = false, initialFilters = {} } = options;

  const [metrics, setMetrics] = useState<AttendanceMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<UseAttendanceMetricsFilters>(initialFilters);

  const fetchMetrics = useCallback(async (filters?: UseAttendanceMetricsFilters) => {
    setIsLoading(true);
    setError(null);
    
    const mergedFilters = { ...currentFilters, ...filters };
    setCurrentFilters(mergedFilters);
    
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
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch attendance metrics";
      setError(message);
      console.error("Error fetching attendance metrics:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilters]);

  const refetch = useCallback(async () => {
    await fetchMetrics(currentFilters);
  }, [fetchMetrics, currentFilters]);

  useEffect(() => {
    if (autoFetch) {
      fetchMetrics();
    }
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
export function useAttendanceMetricsByAthlete(athleteId?: string, options: Omit<UseAttendanceMetricsOptions, 'initialFilters'> = {}) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "athlete", athleteId },
  });
}

export function useAttendanceMetricsByProgram(programId?: string, options: Omit<UseAttendanceMetricsOptions, 'initialFilters'> = {}) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "program", programId },
  });
}

export function useAttendanceMetricsByCoach(coachId?: string, options: Omit<UseAttendanceMetricsOptions, 'initialFilters'> = {}) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "coach", coachId },
  });
}

export function useAttendanceMetricsByDate(startDate?: string, endDate?: string, options: Omit<UseAttendanceMetricsOptions, 'initialFilters'> = {}) {
  return useAttendanceMetrics({
    ...options,
    initialFilters: { groupBy: "date", startDate, endDate },
  });
}
