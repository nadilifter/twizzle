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
  updateProgram: (id: string, data: UpdateProgramPayload) => Promise<ProgramWithRelations | null>;
  deleteProgram: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing programs list data and CRUD operations
 */
export function usePrograms(options: UseProgramsOptions = {}): UseProgramsReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // State
  const [programs, setPrograms] = useState<ProgramWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
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

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<ProgramsListResponse>("/api/programs", queryParams);
      setPrograms(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch programs";
      setError(message);
      console.error("Error fetching programs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create program
  const createProgram = useCallback(async (data: CreateProgramPayload): Promise<ProgramWithRelations | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const newProgram = await api.post<ProgramWithRelations>("/api/programs", data);
      // Add to local state
      setPrograms((prev) => [...prev, newProgram]);
      setTotal((prev) => prev + 1);
      return newProgram;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create program";
      setError(message);
      console.error("Error creating program:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Update program
  const updateProgram = useCallback(async (
    id: string,
    data: UpdateProgramPayload
  ): Promise<ProgramWithRelations | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedProgram = await api.patch<ProgramWithRelations>(`/api/programs/${id}`, data);
      // Update local state
      setPrograms((prev) =>
        prev.map((program) => (program.id === id ? updatedProgram : program))
      );
      return updatedProgram;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update program";
      setError(message);
      console.error("Error updating program:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Delete program
  const deleteProgram = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/programs/${id}`);
      // Remove from local state
      setPrograms((prev) => prev.filter((program) => program.id !== id));
      setTotal((prev) => prev - 1);
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
    if (autoFetch) {
      fetchPrograms(initialParams);
    }
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
