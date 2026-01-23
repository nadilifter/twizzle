"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AthleteWithRelations,
  AthleteDetail,
  AthletesListResponse,
  AthletesQueryParams,
  CreateAthletePayload,
  UpdateAthletePayload,
} from "@/types/athletes";

interface UseAthletesOptions {
  autoFetch?: boolean;
  initialParams?: AthletesQueryParams;
}

interface UseAthletesReturn {
  // Data
  athletes: AthleteWithRelations[];
  total: number;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  fetchAthletes: (params?: AthletesQueryParams) => Promise<void>;
  createAthlete: (data: CreateAthletePayload) => Promise<AthleteWithRelations | null>;
  updateAthlete: (id: string, data: UpdateAthletePayload) => Promise<AthleteWithRelations | null>;
  deleteAthlete: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing athletes list data and CRUD operations
 */
export function useAthletes(options: UseAthletesOptions = {}): UseAthletesReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // State
  const [athletes, setAthletes] = useState<AthleteWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<AthletesQueryParams>(initialParams);

  // Fetch athletes list
  const fetchAthletes = useCallback(async (params?: AthletesQueryParams) => {
    const queryParams = params ?? currentParams;
    setCurrentParams(queryParams);
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<AthletesListResponse>("/api/athletes", queryParams);
      setAthletes(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch athletes";
      setError(message);
      console.error("Error fetching athletes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentParams]);

  // Create athlete
  const createAthlete = useCallback(async (data: CreateAthletePayload): Promise<AthleteWithRelations | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const newAthlete = await api.post<AthleteWithRelations>("/api/athletes", data);
      // Add to local state
      setAthletes((prev) => [...prev, newAthlete]);
      setTotal((prev) => prev + 1);
      return newAthlete;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create athlete";
      setError(message);
      console.error("Error creating athlete:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Update athlete
  const updateAthlete = useCallback(async (
    id: string,
    data: UpdateAthletePayload
  ): Promise<AthleteWithRelations | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedAthlete = await api.patch<AthleteWithRelations>(`/api/athletes/${id}`, data);
      // Update local state
      setAthletes((prev) =>
        prev.map((athlete) => (athlete.id === id ? updatedAthlete : athlete))
      );
      return updatedAthlete;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update athlete";
      setError(message);
      console.error("Error updating athlete:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Delete athlete
  const deleteAthlete = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/athletes/${id}`);
      // Remove from local state
      setAthletes((prev) => prev.filter((athlete) => athlete.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete athlete";
      setError(message);
      console.error("Error deleting athlete:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // Refresh current data
  const refresh = useCallback(async () => {
    await fetchAthletes(currentParams);
  }, [fetchAthletes, currentParams]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchAthletes(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    athletes,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchAthletes,
    createAthlete,
    updateAthlete,
    deleteAthlete,
    refresh,
    clearError,
  };
}

interface UseAthleteReturn {
  athlete: AthleteDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchAthlete: () => Promise<void>;
  updateAthlete: (data: UpdateAthletePayload) => Promise<AthleteDetail | null>;
  deleteAthlete: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for managing a single athlete's data
 */
export function useAthlete(athleteId: string | null): UseAthleteReturn {
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch single athlete
  const fetchAthlete = useCallback(async () => {
    if (!athleteId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<AthleteDetail>(`/api/athletes/${athleteId}`);
      setAthlete(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch athlete";
      setError(message);
      console.error("Error fetching athlete:", err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  // Update athlete
  const updateAthlete = useCallback(async (data: UpdateAthletePayload): Promise<AthleteDetail | null> => {
    if (!athleteId) return null;

    setIsUpdating(true);
    setError(null);

    try {
      const updated = await api.patch<AthleteDetail>(`/api/athletes/${athleteId}`, data);
      setAthlete(updated);
      return updated;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update athlete";
      setError(message);
      console.error("Error updating athlete:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [athleteId]);

  // Delete athlete
  const deleteAthlete = useCallback(async (): Promise<boolean> => {
    if (!athleteId) return false;

    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/athletes/${athleteId}`);
      setAthlete(null);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete athlete";
      setError(message);
      console.error("Error deleting athlete:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [athleteId]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch on mount and when ID changes
  useEffect(() => {
    if (athleteId) {
      fetchAthlete();
    } else {
      setAthlete(null);
    }
  }, [athleteId, fetchAthlete]);

  return {
    athlete,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    fetchAthlete,
    updateAthlete,
    deleteAthlete,
    clearError,
  };
}
