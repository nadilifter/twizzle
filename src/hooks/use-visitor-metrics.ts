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

// Module-level stale-while-revalidate cache keyed by date range.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = { data: VisitorMetrics; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(startDate?: string, endDate?: string): string {
  return JSON.stringify({ startDate, endDate });
}

/**
 * Hook to fetch visitor metrics from the analytics API
 * Returns daily breakdown by device type (mobile vs desktop)
 */
export function useVisitorMetrics(options: UseVisitorMetricsOptions = {}): UseVisitorMetricsReturn {
  const { startDate, endDate, autoFetch = true } = options;

  const initialKey = paramsKey(startDate, endDate);
  const initialCached = listCache.get(initialKey);

  const [data, setData] = useState<VisitorMetrics | null>(() => initialCached?.data ?? null);
  const [loading, setLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    const key = paramsKey(startDate, endDate);
    const cached = listCache.get(key);
    if (!cached) setLoading(true);
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
      listCache.set(key, { data: metrics, fetchedAt: Date.now() });
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
    if (!autoFetch) return;
    const key = paramsKey(startDate, endDate);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setData(cached.data);
      return;
    }
    fetchMetrics();
  }, [autoFetch, fetchMetrics, startDate, endDate]);

  return {
    data,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
