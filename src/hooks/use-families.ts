"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  FamilyWithRelations,
  FamilyDetail,
  FamiliesListResponse,
  FamiliesQueryParams,
  CreateFamilyPayload,
  UpdateFamilyPayload,
} from "@/types/families";

interface UseFamiliesOptions {
  autoFetch?: boolean;
  initialParams?: FamiliesQueryParams;
}

interface UseFamiliesReturn {
  // Data
  families: FamilyWithRelations[];
  total: number;
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  
  // Error state
  error: string | null;
  
  // Actions
  fetchFamilies: (params?: FamiliesQueryParams) => Promise<void>;
  createFamily: (data: CreateFamilyPayload) => Promise<FamilyWithRelations | null>;
  updateFamily: (id: string, data: UpdateFamilyPayload) => Promise<FamilyWithRelations | null>;
  deleteFamily: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing families list data and CRUD operations
 */
export function useFamilies(options: UseFamiliesOptions = {}): UseFamiliesReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // State
  const [families, setFamilies] = useState<FamilyWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<FamiliesQueryParams>(initialParams);

  // Fetch families list
  const fetchFamilies = useCallback(async (params?: FamiliesQueryParams) => {
    const queryParams = params ?? currentParams;
    setCurrentParams(queryParams);
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<FamiliesListResponse>("/api/families", queryParams);
      setFamilies(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch families";
      setError(message);
      console.error("Error fetching families:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentParams]);

  // Create family
  const createFamily = useCallback(async (data: CreateFamilyPayload): Promise<FamilyWithRelations | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const newFamily = await api.post<FamilyWithRelations>("/api/families", data);
      // Add to local state with default counts
      const familyWithCounts: FamilyWithRelations = {
        ...newFamily,
        athletes: [],
        _count: { invoices: 0, paymentMethods: 0 },
      };
      setFamilies((prev) => [...prev, familyWithCounts]);
      setTotal((prev) => prev + 1);
      return familyWithCounts;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create family";
      setError(message);
      console.error("Error creating family:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  // Update family
  const updateFamily = useCallback(async (
    id: string,
    data: UpdateFamilyPayload
  ): Promise<FamilyWithRelations | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedFamily = await api.patch<FamilyWithRelations>(`/api/families/${id}`, data);
      // Update local state - preserve existing counts if not returned
      setFamilies((prev) =>
        prev.map((family) => {
          if (family.id === id) {
            return {
              ...family,
              ...updatedFamily,
              _count: updatedFamily._count ?? family._count,
            };
          }
          return family;
        })
      );
      return updatedFamily;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update family";
      setError(message);
      console.error("Error updating family:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  // Delete family
  const deleteFamily = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/families/${id}`);
      // Remove from local state
      setFamilies((prev) => prev.filter((family) => family.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete family";
      setError(message);
      console.error("Error deleting family:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  // Refresh current data
  const refresh = useCallback(async () => {
    await fetchFamilies(currentParams);
  }, [fetchFamilies, currentParams]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch) {
      fetchFamilies(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    families,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchFamilies,
    createFamily,
    updateFamily,
    deleteFamily,
    refresh,
    clearError,
  };
}

interface UseFamilyReturn {
  family: FamilyDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchFamily: () => Promise<void>;
  updateFamily: (data: UpdateFamilyPayload) => Promise<FamilyDetail | null>;
  deleteFamily: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for managing a single family's data
 */
export function useFamily(familyId: string | null): UseFamilyReturn {
  const [family, setFamily] = useState<FamilyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch single family
  const fetchFamily = useCallback(async () => {
    if (!familyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<FamilyDetail>(`/api/families/${familyId}`);
      setFamily(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch family";
      setError(message);
      console.error("Error fetching family:", err);
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  // Update family
  const updateFamily = useCallback(async (data: UpdateFamilyPayload): Promise<FamilyDetail | null> => {
    if (!familyId) return null;

    setIsUpdating(true);
    setError(null);

    try {
      const updated = await api.patch<FamilyDetail>(`/api/families/${familyId}`, data);
      setFamily(updated);
      return updated;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update family";
      setError(message);
      console.error("Error updating family:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [familyId]);

  // Delete family
  const deleteFamily = useCallback(async (): Promise<boolean> => {
    if (!familyId) return false;

    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/families/${familyId}`);
      setFamily(null);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete family";
      setError(message);
      console.error("Error deleting family:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [familyId]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch on mount and when ID changes
  useEffect(() => {
    if (familyId) {
      fetchFamily();
    } else {
      setFamily(null);
    }
  }, [familyId, fetchFamily]);

  return {
    family,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    fetchFamily,
    updateFamily,
    deleteFamily,
    clearError,
  };
}
