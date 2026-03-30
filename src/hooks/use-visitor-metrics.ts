"use client";

import { useState, useEffect, useCallback } from "react";

export interface DailyVisitorCount {
  date: string;
  desktop: number;
  mobile: number;
  total: number;
}

export interface VisitorMetrics {
  daily: DailyVisitorCount[];
  total: number;
  totalDesktop: number;
  totalMobile: number;
  today: number;
  todayDesktop: number;
  todayMobile: number;
  yesterday: number;
  percentChange: number | null;
}

interface UseVisitorMetricsOptions {
  startDate?: string;
  endDate?: string;
  autoFetch?: boolean;
}

interface UseVisitorMetricsReturn {
  data: VisitorMetrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch visitor metrics from the analytics API
 * Returns daily breakdown by device type (mobile vs desktop)
 */
export function useVisitorMetrics(options: UseVisitorMetricsOptions = {}): UseVisitorMetricsReturn {
  const { startDate, endDate, autoFetch = true } = options;

  const [data, setData] = useState<VisitorMetrics | null>(null);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const url = `/api/analytics/visitors${params.toString() ? `?${params}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch visitor metrics");
      }

      const metrics: VisitorMetrics = await response.json();
      setData(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      // Set default empty data on error
      setData({
        daily: [],
        total: 0,
        totalDesktop: 0,
        totalMobile: 0,
        today: 0,
        todayDesktop: 0,
        todayMobile: 0,
        yesterday: 0,
        percentChange: null,
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

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
