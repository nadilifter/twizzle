"use client";

import { useState, useEffect, useCallback } from "react";

export interface QueueConfig {
  id: string;
  organizationId: string;
  programId: string | null;
  isEnabled: boolean;
  reservationMinutes: number;
  maxConcurrent: number;
  activationType: "ALWAYS" | "THRESHOLD" | "SCHEDULED";
  activationThreshold: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  createdAt: string;
  updatedAt: string;
  program?: {
    id: string;
    name: string;
    level: string;
    status: string;
  } | null;
  _count?: {
    entries: number;
  };
}

export interface QueueStats {
  configId: string;
  waiting: number;
  admitted: number;
  completed: number;
  expired: number;
  abandoned: number;
  activeReservations: number;
}

interface UseQueueConfigParams {
  includeProgram?: boolean;
  includeStats?: boolean;
}

interface UseQueueConfigReturn {
  configs: QueueConfig[];
  stats: Record<string, QueueStats>;
  isLoading: boolean;
  error: string | null;
  fetchConfigs: () => Promise<void>;
  createConfig: (data: Partial<QueueConfig>) => Promise<QueueConfig | null>;
  updateConfig: (id: string, data: Partial<QueueConfig>) => Promise<QueueConfig | null>;
  deleteConfig: (id: string) => Promise<boolean>;
  toggleConfig: (id: string, enabled: boolean) => Promise<boolean>;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  configs: QueueConfig[];
  stats: Record<string, QueueStats>;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: UseQueueConfigParams | undefined): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

export function useQueueConfig(params?: UseQueueConfigParams): UseQueueConfigReturn {
  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(params);
  const initialCached = listCache.get(initialKey);

  const [configs, setConfigs] = useState<QueueConfig[]>(() => initialCached?.configs ?? []);
  const [stats, setStats] = useState<Record<string, QueueStats>>(() => initialCached?.stats ?? {});
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    const key = paramsKey(params);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.includeProgram) queryParams.set("include", "program");

      const response = await fetch(`/api/registrations/queues?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch queue configs");
      }
      const data = await response.json();
      const nextConfigs: QueueConfig[] = data.configs || data;
      const nextStats: Record<string, QueueStats> =
        params?.includeStats && data.stats ? data.stats : {};

      setConfigs(nextConfigs);
      if (params?.includeStats && data.stats) {
        setStats(nextStats);
      }
      listCache.set(key, {
        configs: nextConfigs,
        stats: nextStats,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const key = paramsKey(params);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchConfigs();
  }, [fetchConfigs, params]);

  const createConfig = async (data: Partial<QueueConfig>): Promise<QueueConfig | null> => {
    try {
      const response = await fetch("/api/registrations/queues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create config");
      }
      const newConfig = await response.json();
      setConfigs((prev) => [...prev, newConfig]);
      invalidateLists();
      return newConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return null;
    }
  };

  const updateConfig = async (
    id: string,
    data: Partial<QueueConfig>
  ): Promise<QueueConfig | null> => {
    try {
      const response = await fetch(`/api/registrations/queues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update config");
      }
      const updatedConfig = await response.json();
      setConfigs((prev) => prev.map((c) => (c.id === id ? updatedConfig : c)));
      invalidateLists();
      return updatedConfig;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return null;
    }
  };

  const deleteConfig = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/registrations/queues/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete config");
      }
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      invalidateLists();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      return false;
    }
  };

  const toggleConfig = async (id: string, enabled: boolean): Promise<boolean> => {
    const result = await updateConfig(id, { isEnabled: enabled });
    return result !== null;
  };

  return {
    configs,
    stats,
    isLoading,
    error,
    fetchConfigs,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleConfig,
  };
}
