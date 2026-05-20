"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";

interface Level {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  order: number;
  color: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    skills: number;
  };
}

interface UseLevelsReturn {
  levels: Level[];
  isLoading: boolean;
  error: string | null;
  fetchLevels: () => Promise<void>;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_KEY = "levels";
type ListCacheEntry = { data: Level[]; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();

export function useLevels(): UseLevelsReturn {
  const initialCached = listCache.get(LIST_CACHE_KEY);

  const [levels, setLevels] = useState<Level[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchLevels = useCallback(async () => {
    const cached = listCache.get(LIST_CACHE_KEY);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Level[]>("/api/levels");
      setLevels(response);
      listCache.set(LIST_CACHE_KEY, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch levels";
      setError(message);
      console.error("Error fetching levels:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    const cached = listCache.get(LIST_CACHE_KEY);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchLevels();
  }, [fetchLevels]);

  return {
    levels,
    isLoading,
    error,
    fetchLevels,
  };
}
