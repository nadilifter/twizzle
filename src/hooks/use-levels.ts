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

export function useLevels(): UseLevelsReturn {
  const [levels, setLevels] = useState<Level[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchLevels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Level[]>("/api/levels");
      setLevels(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch levels";
      setError(message);
      console.error("Error fetching levels:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchLevels();
    }
  }, [fetchLevels]);

  return {
    levels,
    isLoading,
    error,
    fetchLevels,
  };
}
