"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  ProgramWithRelations,
  ProgramsListResponse,
  ProgramsQueryParams,
  CreateProgramPayload,
  UpdateProgramPayload,
} from "@/types/programs";

interface UseProgramsOptions {
  autoFetch?: boolean;
  initialParams?: ProgramsQueryParams;
}

interface UseProgramsReturn {
  // Data
  programs: ProgramWithRelations[];
  total: number;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchPrograms: (params?: ProgramsQueryParams) => Promise<void>;
  createProgram: (data: CreateProgramPayload) => Promise<ProgramWithRelations | null>;
  updateProgram: (
    id: string,
    data: UpdateProgramPayload
  ) => Promise<{ data: ProgramWithRelations | null; error: string | null }>;
  deleteProgram: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: ProgramWithRelations[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: ProgramsQueryParams): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

/**
 * Hook for managing programs list data and CRUD operations
 */
export function usePrograms(options: UseProgramsOptions = {}): UseProgramsReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  // State
  const [programs, setPrograms] = useState<ProgramWithRelations[]>(() => initialCached?.data ?? []);
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<ProgramsQueryParams>(initialParams);

  // Ref to track current params for stable fetchPrograms
  const currentParamsRef = useRef<ProgramsQueryParams>(initialParams);

  // Sync ref with state
  useEffect(() => {
    currentParamsRef.current = currentParams;
  }, [currentParams]);

  // Fetch programs list
  const fetchPrograms = useCallback(async (params?: ProgramsQueryParams) => {
    const queryParams = params ?? currentParamsRef.current;

    if (params) {
      setCurrentParams(queryParams);
    }

    const key = paramsKey(queryParams);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ProgramsListResponse>("/api/programs", queryParams);
      setPrograms(response.data);
      setTotal(response.total);
      listCache.set(key, {
        data: response.data,
        total: response.total,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch programs";
      setError(message);
      console.error("Error fetching programs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create program
  const createProgram = useCallback(
    async (data: CreateProgramPayload): Promise<ProgramWithRelations | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newProgram = await api.post<ProgramWithRelations>("/api/programs", data);
        // Add to local state
        setPrograms((prev) => [...prev, newProgram]);
        setTotal((prev) => prev + 1);
        invalidateLists();
        return newProgram;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create program";
        setError(message);
        console.error("Error creating program:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  // Update program
  const updateProgram = useCallback(
    async (
      id: string,
      data: UpdateProgramPayload
    ): Promise<{ data: ProgramWithRelations | null; error: string | null }> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedProgram = await api.patch<ProgramWithRelations>(`/api/programs/${id}`, data);
        setPrograms((prev) =>
          prev.map((program) => (program.id === id ? updatedProgram : program))
        );
        invalidateLists();
        return { data: updatedProgram, error: null };
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update program";
        setError(message);
        console.error("Error updating program:", err);
        return { data: null, error: message };
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  // Delete program
  const deleteProgram = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/programs/${id}`);
      // Remove from local state
      setPrograms((prev) => prev.filter((program) => program.id !== id));
      setTotal((prev) => prev - 1);
      invalidateLists();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete program";
      setError(message);
      console.error("Error deleting program:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // Refresh current data
  const refresh = useCallback(async () => {
    await fetchPrograms(currentParams);
  }, [fetchPrograms, currentParams]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (!autoFetch) return;
    const key = paramsKey(initialParams);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchPrograms(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    programs,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchPrograms,
    createProgram,
    updateProgram,
    deleteProgram,
    refresh,
    clearError,
  };
}
