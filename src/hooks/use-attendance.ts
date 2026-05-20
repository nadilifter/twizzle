"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AttendanceWithRelations,
  AttendanceQueryParams,
  CreateAttendancePayload,
  UpdateAttendancePayload,
  BulkAttendancePayload,
} from "@/types/attendance";

interface UseAttendanceOptions {
  autoFetch?: boolean;
  initialParams?: AttendanceQueryParams;
}

interface UseAttendanceReturn {
  attendances: AttendanceWithRelations[];
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  fetchAttendance: (params?: AttendanceQueryParams) => Promise<void>;
  markAttendance: (data: CreateAttendancePayload) => Promise<AttendanceWithRelations | null>;
  updateAttendance: (
    id: string,
    data: UpdateAttendancePayload
  ) => Promise<AttendanceWithRelations | null>;
  bulkMarkAttendance: (data: BulkAttendancePayload) => Promise<boolean>;
  deleteAttendance: (id: string) => Promise<boolean>;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: AttendanceWithRelations[];
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: AttendanceQueryParams | undefined): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

export function useAttendance(options: UseAttendanceOptions = {}): UseAttendanceReturn {
  const { autoFetch = false, initialParams } = options;
  const initialParamsRef = useRef(initialParams);
  initialParamsRef.current = initialParams;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [attendances, setAttendances] = useState<AttendanceWithRelations[]>(
    () => initialCached?.data ?? []
  );
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (params?: AttendanceQueryParams) => {
    const queryParams = { ...initialParamsRef.current, ...params };
    const cleanParams = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    ) as AttendanceQueryParams;

    const key = paramsKey(cleanParams);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{ data: AttendanceWithRelations[] }>(
        "/api/attendance",
        cleanParams
      );
      setAttendances(response.data);
      listCache.set(key, { data: response.data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch attendance";
      setError(message);
      console.error("Error fetching attendance:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAttendance = useCallback(async (data: CreateAttendancePayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await api.post<AttendanceWithRelations>("/api/attendance", data);
      setAttendances((prev) => {
        // If exists, update, else add
        const index = prev.findIndex((a) => a.id === result.id);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = result;
          return newArr;
        }
        return [...prev, result];
      });
      invalidateLists();
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to mark attendance";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const updateAttendance = useCallback(async (id: string, data: UpdateAttendancePayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await api.patch<AttendanceWithRelations>(`/api/attendance/${id}`, data);
      setAttendances((prev) => prev.map((a) => (a.id === id ? result : a)));
      invalidateLists();
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update attendance";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const bulkMarkAttendance = useCallback(
    async (data: BulkAttendancePayload) => {
      setIsUpdating(true);
      setError(null);
      try {
        // Transform records to attendances format expected by API
        await api.post("/api/attendance", {
          eventId: data.eventId,
          attendances: data.records,
        });
        invalidateLists();
        // Refresh after bulk update
        await fetchAttendance({ eventId: data.eventId });
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to bulk mark attendance";
        setError(message);
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [fetchAttendance]
  );

  const deleteAttendance = useCallback(async (id: string) => {
    setIsUpdating(true);
    setError(null);
    try {
      await api.delete(`/api/attendance/${id}`);
      setAttendances((prev) => prev.filter((a) => a.id !== id));
      invalidateLists();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete attendance";
      setError(message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = paramsKey(initialParamsRef.current);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    attendances,
    isLoading,
    isUpdating,
    error,
    fetchAttendance,
    markAttendance,
    updateAttendance,
    bulkMarkAttendance,
    deleteAttendance,
  };
}
