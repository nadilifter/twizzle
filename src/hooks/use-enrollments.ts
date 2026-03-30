"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  EnrollmentWithRelations,
  EnrollmentsQueryParams,
  CreateEnrollmentPayload,
  EnrollmentsListResponse,
} from "@/types/enrollments";

interface UseEnrollmentsOptions {
  autoFetch?: boolean;
  initialParams?: EnrollmentsQueryParams;
}

interface UseEnrollmentsReturn {
  enrollments: EnrollmentWithRelations[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  fetchEnrollments: (params?: EnrollmentsQueryParams) => Promise<void>;
  createEnrollment: (data: CreateEnrollmentPayload) => Promise<EnrollmentWithRelations | null>;
}

export function useEnrollments(options: UseEnrollmentsOptions = {}): UseEnrollmentsReturn {
  const { autoFetch = false, initialParams = {} } = options;

  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEnrollments = useCallback(
    async (params?: EnrollmentsQueryParams) => {
      setIsLoading(true);
      setError(null);
      try {
        const queryParams = { ...initialParams, ...params };
        // Filter out undefined
        const cleanParams = Object.fromEntries(
          Object.entries(queryParams).filter(([_, v]) => v !== undefined)
        );

        const response = await api.get<EnrollmentsListResponse>("/api/enrollments", cleanParams);
        setEnrollments(response.data);
        setTotal(response.total);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch enrollments";
        setError(message);
        console.error("Error fetching enrollments:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [initialParams]
  );

  const createEnrollment = useCallback(async (data: CreateEnrollmentPayload) => {
    setIsCreating(true);
    setError(null);
    try {
      const result = await api.post<EnrollmentWithRelations>("/api/enrollments", data);
      setEnrollments((prev) => [result, ...prev]);
      setTotal((prev) => prev + 1);
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create enrollment";
      setError(message);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return {
    enrollments,
    total,
    isLoading,
    isCreating,
    error,
    fetchEnrollments,
    createEnrollment,
  };
}
