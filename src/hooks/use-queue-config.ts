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

export function useQueueConfig(params?: UseQueueConfigParams): UseQueueConfigReturn {
  const [configs, setConfigs] = useState<QueueConfig[]>([]);
  const [stats, setStats] = useState<Record<string, QueueStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params?.includeProgram) queryParams.set("include", "program");

      const response = await fetch(`/api/registrations/queues?${queryParams}`);
      if (!response.ok) {
        throw new Error("Failed to fetch queue configs");
      }
      const data = await response.json();
      setConfigs(data.configs || data);

      if (params?.includeStats && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [params?.includeProgram, params?.includeStats]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

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
