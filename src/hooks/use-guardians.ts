"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";

export interface GuardianUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  balance: number;
  status: string;
  athletes: { id: string; name: string; status: string }[];
}

interface GuardiansListResponse {
  data: GuardianUser[];
  total: number;
  limit: number;
  offset: number;
}

interface UseGuardiansReturn {
  guardians: GuardianUser[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchGuardians: (params?: { search?: string }) => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: GuardianUser[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: { search?: string } | undefined): string {
  return JSON.stringify(params ?? {});
}

export function useGuardians(options: { autoFetch?: boolean } = {}): UseGuardiansReturn {
  const { autoFetch = true } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(undefined);
  const initialCached = listCache.get(initialKey);

  const [guardians, setGuardians] = useState<GuardianUser[]>(() => initialCached?.data ?? []);
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchGuardians = useCallback(async (params?: { search?: string }) => {
    const key = paramsKey(params);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<GuardiansListResponse>("/api/guardians", params);
      setGuardians(response.data);
      setTotal(response.total);
      listCache.set(key, {
        data: response.data,
        total: response.total,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch guardians";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch || fetchedRef.current) return;
    fetchedRef.current = true;
    const key = paramsKey(undefined);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchGuardians();
  }, [autoFetch, fetchGuardians]);

  return {
    guardians,
    total,
    isLoading,
    error,
    fetchGuardians,
    clearError,
  };
}
