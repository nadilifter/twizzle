"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";

interface CoachAthlete {
  id: string;
  name: string;
  email: string | null;
  level: string;
  group: string;
  status: string;
  avatar: string | null;
  programs: {
    id: string;
    name: string;
    level: string;
  }[];
}

interface CoachAthletesResponse {
  data: CoachAthlete[];
  total: number;
  limit: number;
  offset: number;
}

interface UseCoachAthletesOptions {
  autoFetch?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

interface UseCoachAthletesReturn {
  athletes: CoachAthlete[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchAthletes: (params?: { search?: string; limit?: number; offset?: number }) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for fetching athletes from events assigned to the current coach.
 * Returns athletes enrolled in programs where the coach has assigned events.
 */
export function useCoachAthletes(options: UseCoachAthletesOptions = {}): UseCoachAthletesReturn {
  const { autoFetch = true, search = "", limit = 100, offset = 0 } = options;

  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentParamsRef = useRef<{ search?: string; limit?: number; offset?: number }>({
    search,
    limit,
    offset,
  });

  const fetchAthletes = useCallback(
    async (params?: { search?: string; limit?: number; offset?: number }) => {
      const queryParams = params ?? currentParamsRef.current;
      currentParamsRef.current = queryParams;

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<CoachAthletesResponse>("/api/coach/athletes", queryParams);
        setAthletes(response.data);
        setTotal(response.total);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch athletes";
        setError(message);
        console.error("Error fetching coach athletes:", err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    await fetchAthletes(currentParamsRef.current);
  }, [fetchAthletes]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchAthletes({ search, limit, offset });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    athletes,
    total,
    isLoading,
    error,
    fetchAthletes,
    refresh,
    clearError,
  };
}
