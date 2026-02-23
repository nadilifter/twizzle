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

export function useGuardians(options: { autoFetch?: boolean } = {}): UseGuardiansReturn {
  const { autoFetch = true } = options;

  const [guardians, setGuardians] = useState<GuardianUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  const fetchGuardians = useCallback(async (params?: { search?: string }) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<GuardiansListResponse>("/api/guardians", params);
      setGuardians(response.data);
      setTotal(response.total);
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
    if (autoFetch && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchGuardians();
    }
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
