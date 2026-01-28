"use client";

import { useState, useEffect, useCallback } from "react";

export interface EnrollmentMetrics {
  newThisPeriod: number;
  newPreviousPeriod: number;
  percentChange: number | null;
  activeTotal: number;
  activePreviousTotal: number;
  growthRate: number | null;
}

interface UseEnrollmentMetricsOptions {
  periodDays?: number;
  autoFetch?: boolean;
}

interface UseEnrollmentMetricsReturn {
  data: EnrollmentMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch enrollment metrics from the analytics API
 * Returns new enrollment counts and growth rate comparisons
 */
export function useEnrollmentMetrics(
  options: UseEnrollmentMetricsOptions = {}
): UseEnrollmentMetricsReturn {
  const { periodDays = 30, autoFetch = true } = options;

  const [data, setData] = useState<EnrollmentMetrics | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (periodDays !== 30) {
        params.append("periodDays", periodDays.toString());
      }

      const url = `/api/analytics/enrollments${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch enrollment metrics");
      }

      const metrics: EnrollmentMetrics = await response.json();
      setData(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      // Set default empty data on error
      setData({
        newThisPeriod: 0,
        newPreviousPeriod: 0,
        percentChange: null,
        activeTotal: 0,
        activePreviousTotal: 0,
        growthRate: null,
      });
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    if (autoFetch) {
      fetchMetrics();
    }
  }, [autoFetch, fetchMetrics]);

  return {
    data,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
