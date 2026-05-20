"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";
import type {
  Pass,
  PassesListResponse,
  PassesQueryParams,
  CreatePassPayload,
  UpdatePassPayload,
  AthletePass,
  PassProgram,
} from "@/types/passes";

interface UsePassesOptions {
  autoFetch?: boolean;
  initialParams?: PassesQueryParams;
}

interface UsePassesReturn {
  passes: Pass[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchPasses: (params?: PassesQueryParams) => Promise<void>;
  createPass: (data: CreatePassPayload) => Promise<Pass | null>;
  deletePass: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: Pass[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();
const detailCache = new Map<string, { data: Pass; fetchedAt: number }>();

function paramsKey(params: PassesQueryParams): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

function invalidateDetail(id: string) {
  detailCache.delete(id);
}

export function usePasses(options: UsePassesOptions = {}): UsePassesReturn {
  const { autoFetch = true, initialParams = {} } = options;
  const { data: session } = useSession();

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [passes, setPasses] = useState<Pass[]>(() => initialCached?.data ?? []);
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<PassesQueryParams>(initialParams);

  const fetchPasses = useCallback(
    async (params?: PassesQueryParams) => {
      const queryParams = params ?? currentParams;
      setCurrentParams(queryParams);

      const key = paramsKey(queryParams);
      const cached = listCache.get(key);
      if (!cached) setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<PassesListResponse>("/api/passes", queryParams);
        setPasses(response.data);
        setTotal(response.total);
        listCache.set(key, {
          data: response.data,
          total: response.total,
          fetchedAt: Date.now(),
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch passes";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [currentParams]
  );

  const createPass = useCallback(async (data: CreatePassPayload): Promise<Pass | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const newPass = await api.post<Pass>("/api/passes", data);
      setPasses((prev) => [...prev, newPass]);
      setTotal((prev) => prev + 1);
      invalidateLists();
      return newPass;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create pass";
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const deletePass = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/passes/${id}`);
      setPasses((prev) => prev.filter((p) => p.id !== id));
      setTotal((prev) => prev - 1);
      invalidateLists();
      invalidateDetail(id);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete pass";
      setError(message);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchPasses(currentParams);
  }, [fetchPasses, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch || !session?.user?.organizationId) return;
    const key = paramsKey(initialParams);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchPasses(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.organizationId]);

  return {
    passes,
    total,
    isLoading,
    isCreating,
    isDeleting,
    error,
    fetchPasses,
    createPass,
    deletePass,
    refresh,
    clearError,
  };
}

// Hook for managing a single pass with its programs and athletes
interface UsePassOptions {
  autoFetch?: boolean;
}

interface UsePassReturn {
  pass: Pass | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  fetchPass: () => Promise<void>;
  updatePass: (data: UpdatePassPayload) => Promise<Pass | null>;
  addProgram: (programId: string) => Promise<boolean>;
  removeProgram: (programId: string) => Promise<boolean>;
  addAthlete: (
    athleteId: string,
    data: { startDate: string; endDate?: string; autoRenew?: boolean }
  ) => Promise<boolean>;
  removeAthlete: (athleteId: string) => Promise<boolean>;
  clearError: () => void;
}

export function usePass(passId: string | null, options: UsePassOptions = {}): UsePassReturn {
  const { autoFetch = true } = options;
  const { data: session } = useSession();

  const cached = passId ? detailCache.get(passId) : undefined;

  const [pass, setPass] = useState<Pass | null>(() => cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !!passId && !cached);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPass = useCallback(async () => {
    if (!passId) return;
    const existing = detailCache.get(passId);
    if (!existing) setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<Pass>(`/api/passes/${passId}`);
      setPass(data);
      detailCache.set(passId, { data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch pass";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [passId]);

  const updatePass = useCallback(
    async (data: UpdatePassPayload): Promise<Pass | null> => {
      if (!passId) return null;
      setIsUpdating(true);
      setError(null);

      try {
        const updated = await api.patch<Pass>(`/api/passes/${passId}`, data);
        setPass(updated);
        detailCache.set(passId, { data: updated, fetchedAt: Date.now() });
        invalidateLists();
        return updated;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update pass";
        setError(message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [passId]
  );

  const addProgram = useCallback(
    async (programId: string): Promise<boolean> => {
      if (!passId) return false;
      setError(null);

      try {
        await api.post(`/api/passes/${passId}/programs`, { programId });
        invalidateDetail(passId);
        await fetchPass();
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to add program";
        setError(message);
        return false;
      }
    },
    [passId, fetchPass]
  );

  const removeProgram = useCallback(
    async (programId: string): Promise<boolean> => {
      if (!passId) return false;
      setError(null);

      try {
        await api.delete(`/api/passes/${passId}/programs`, { programId });
        invalidateDetail(passId);
        await fetchPass();
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to remove program";
        setError(message);
        return false;
      }
    },
    [passId, fetchPass]
  );

  const addAthlete = useCallback(
    async (
      athleteId: string,
      data: { startDate: string; endDate?: string; autoRenew?: boolean }
    ): Promise<boolean> => {
      if (!passId) return false;
      setError(null);

      try {
        await api.post(`/api/passes/${passId}/athletes`, { athleteId, ...data });
        invalidateDetail(passId);
        await fetchPass();
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to add athlete";
        setError(message);
        return false;
      }
    },
    [passId, fetchPass]
  );

  const removeAthlete = useCallback(
    async (athleteId: string): Promise<boolean> => {
      if (!passId) return false;
      setError(null);

      try {
        await api.delete(`/api/passes/${passId}/athletes`, { athleteId });
        invalidateDetail(passId);
        await fetchPass();
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to remove athlete";
        setError(message);
        return false;
      }
    },
    [passId, fetchPass]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch || !passId || !session?.user?.organizationId) return;
    const existing = detailCache.get(passId);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setPass(existing.data);
      return;
    }
    fetchPass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passId, session?.user?.organizationId]);

  return {
    pass,
    isLoading,
    isUpdating,
    error,
    fetchPass,
    updatePass,
    addProgram,
    removeProgram,
    addAthlete,
    removeAthlete,
    clearError,
  };
}
