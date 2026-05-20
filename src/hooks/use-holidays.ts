"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";

export interface OrganizationHoliday {
  id: string;
  organizationId: string;
  date: string;
  name: string;
  type: "NATIONAL" | "CUSTOM";
  isEnabled: boolean;
  year: number;
  countryCode: string | null;
  stateCode: string | null;
  createdAt: string;
  updatedAt: string;
}

interface HolidaysListResponse {
  data: OrganizationHoliday[];
}

export interface ConflictInstance {
  id: string;
  programId: string;
  programName: string;
  startTime: string;
  endTime: string;
  registrationCount: number;
}

export interface MissingProgram {
  id: string;
  name: string;
  startTime: string;
}

export interface EnableConflictsResponse {
  action: "enable";
  date: string;
  instances: ConflictInstance[];
}

export interface DisableConflictsResponse {
  action: "disable";
  date: string;
  programs: MissingProgram[];
}

type ConflictsResponse = EnableConflictsResponse | DisableConflictsResponse;

interface UseHolidaysOptions {
  autoFetch?: boolean;
  initialYear?: number;
}

interface UseHolidaysReturn {
  holidays: OrganizationHoliday[];
  isLoading: boolean;
  error: string | null;
  year: number;
  setYear: (year: number) => void;
  fetchHolidays: (year?: number) => Promise<void>;
  toggleHoliday: (
    id: string,
    isEnabled: boolean,
    cancelInstanceIds?: string[],
    createInstancesForProgramIds?: string[]
  ) => Promise<OrganizationHoliday | null>;
  addCustomClosure: (name: string, date: string) => Promise<OrganizationHoliday | null>;
  deleteHoliday: (id: string) => Promise<boolean>;
  checkConflicts: (date: string, action: "enable" | "disable") => Promise<ConflictsResponse | null>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate cache for the list query keyed by year.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: OrganizationHoliday[];
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(year: number): string {
  return JSON.stringify({ year });
}

function invalidateLists() {
  listCache.clear();
}

export function useHolidays(options: UseHolidaysOptions = {}): UseHolidaysReturn {
  const { autoFetch = true, initialYear = new Date().getFullYear() } = options;
  const { data: session } = useSession();

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialYear);
  const initialCached = listCache.get(initialKey);

  const [holidays, setHolidays] = useState<OrganizationHoliday[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(initialYear);

  const fetchHolidays = useCallback(
    async (fetchYear?: number) => {
      const targetYear = fetchYear ?? year;
      const key = paramsKey(targetYear);
      const cached = listCache.get(key);
      if (!cached) {
        setIsLoading(true);
        setHolidays([]);
      }
      setError(null);

      try {
        const response = await api.get<HolidaysListResponse>("/api/holidays", { year: targetYear });
        setHolidays(response.data);
        listCache.set(key, { data: response.data, fetchedAt: Date.now() });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch holidays";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [year]
  );

  const toggleHoliday = useCallback(
    async (
      id: string,
      isEnabled: boolean,
      cancelInstanceIds?: string[],
      createInstancesForProgramIds?: string[]
    ): Promise<OrganizationHoliday | null> => {
      setError(null);

      try {
        const updated = await api.patch<OrganizationHoliday>(`/api/holidays/${id}`, {
          isEnabled,
          cancelInstanceIds,
          createInstancesForProgramIds,
        });
        setHolidays((prev) => prev.map((h) => (h.id === id ? updated : h)));
        invalidateLists();
        return updated;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update holiday";
        setError(message);
        return null;
      }
    },
    []
  );

  const addCustomClosure = useCallback(
    async (name: string, date: string): Promise<OrganizationHoliday | null> => {
      setError(null);

      try {
        const newHoliday = await api.post<OrganizationHoliday>("/api/holidays", { name, date });
        setHolidays((prev) => {
          const updated = [...prev, newHoliday];
          updated.sort((a, b) => a.date.localeCompare(b.date));
          return updated;
        });
        invalidateLists();
        return newHoliday;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to add closure";
        setError(message);
        return null;
      }
    },
    []
  );

  const deleteHoliday = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      await api.delete(`/api/holidays/${id}`);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      invalidateLists();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete holiday";
      setError(message);
      return false;
    }
  }, []);

  const checkConflicts = useCallback(
    async (date: string, action: "enable" | "disable"): Promise<ConflictsResponse | null> => {
      try {
        return await api.get<ConflictsResponse>("/api/holidays/conflicts", { date, action });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to check conflicts";
        setError(message);
        return null;
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    await fetchHolidays(year);
  }, [fetchHolidays, year]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch || !session?.user?.organizationId) return;
    const key = paramsKey(year);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setHolidays(cached.data);
      return;
    }
    fetchHolidays(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.organizationId, year]);

  return {
    holidays,
    isLoading,
    error,
    year,
    setYear,
    fetchHolidays,
    toggleHoliday,
    addCustomClosure,
    deleteHoliday,
    checkConflicts,
    refresh,
    clearError,
  };
}
