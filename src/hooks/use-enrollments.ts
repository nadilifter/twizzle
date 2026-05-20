"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  EnrollmentWithRelations,
  EnrollmentsQueryParams,
  CreateEnrollmentPayload,
  EnrollmentsListResponse,
} from "@/types/enrollments";

interface UseEnrollmentsOptions {
  autoFetch?: boolean;
  initialParams?: EnrollmentsQueryParams;
}

interface UseEnrollmentsReturn {
  enrollments: EnrollmentWithRelations[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  fetchEnrollments: (params?: EnrollmentsQueryParams) => Promise<void>;
  createEnrollment: (data: CreateEnrollmentPayload) => Promise<EnrollmentWithRelations | null>;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: EnrollmentWithRelations[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: EnrollmentsQueryParams): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

export function useEnrollments(options: UseEnrollmentsOptions = {}): UseEnrollmentsReturn {
  const { initialParams = {} } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>(
    () => initialCached?.data ?? []
  );
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(
    async (params?: EnrollmentsQueryParams) => {
      const queryParams = { ...initialParams, ...params };
      // Filter out undefined
      const cleanParams = Object.fromEntries(
        Object.entries(queryParams).filter(([_, v]) => v !== undefined)
      ) as EnrollmentsQueryParams;

      const key = paramsKey(cleanParams);
      const cached = listCache.get(key);
      if (!cached) setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<EnrollmentsListResponse>("/api/enrollments", cleanParams);
        setEnrollments(response.data);
        setTotal(response.total);
        listCache.set(key, {
          data: response.data,
          total: response.total,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch enrollments";
        setError(message);
        console.error("Error fetching enrollments:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [initialParams]
  );

  const createEnrollment = useCallback(async (data: CreateEnrollmentPayload) => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await api.post<EnrollmentWithRelations>("/api/enrollments", data);
      setEnrollments((prev) => [result, ...prev]);
      setTotal((prev) => prev + 1);
      invalidateLists();
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create enrollment";
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    enrollments,
    total,
    isLoading,
    isCreating,
    error,
    fetchEnrollments,
    createEnrollment,
  };
}
