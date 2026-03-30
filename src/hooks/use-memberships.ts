"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { api, ApiError } from "@/lib/api-client";
import type {
  MembershipGroup,
  MembershipGroupsListResponse,
  MembershipsQueryParams,
  CreateMembershipGroupPayload,
} from "@/types/memberships";

interface UseMembershipsOptions {
  autoFetch?: boolean;
  initialParams?: MembershipsQueryParams;
}

interface UseMembershipsReturn {
  // Data
  memberships: MembershipGroup[];
  total: number;

  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchMemberships: (params?: MembershipsQueryParams) => Promise<void>;
  createMembershipGroup: (data: CreateMembershipGroupPayload) => Promise<MembershipGroup | null>;
  deleteMembershipGroup: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing memberships list data and CRUD operations
 */
export function useMemberships(options: UseMembershipsOptions = {}): UseMembershipsReturn {
  const { autoFetch = true, initialParams = {} } = options;
  const { data: session } = useSession();

  // State
  const [memberships, setMemberships] = useState<MembershipGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentParamsRef = useRef<MembershipsQueryParams>(initialParams);

  const fetchMemberships = useCallback(async (params?: MembershipsQueryParams) => {
    const queryParams = params ?? currentParamsRef.current;
    currentParamsRef.current = queryParams;
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<MembershipGroupsListResponse>("/api/memberships", queryParams);
      setMemberships(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch memberships";
      setError(message);
      console.error("Error fetching memberships:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create membership group
  const createMembershipGroup = useCallback(
    async (data: CreateMembershipGroupPayload): Promise<MembershipGroup | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newMembership = await api.post<MembershipGroup>("/api/memberships", data);
        // Add to local state
        setMemberships((prev) => [...prev, newMembership]);
        setTotal((prev) => prev + 1);
        return newMembership;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create membership group";
        setError(message);
        console.error("Error creating membership group:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  // Delete membership group
  const deleteMembershipGroup = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/memberships/${id}`);
      // Remove from local state
      setMemberships((prev) => prev.filter((membership) => membership.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete membership group";
      setError(message);
      console.error("Error deleting membership group:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchMemberships(currentParamsRef.current);
  }, [fetchMemberships]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && session?.user?.organizationId) {
      fetchMemberships(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.organizationId]);

  return {
    memberships,
    total,
    isLoading,
    isCreating,
    isDeleting,
    error,
    fetchMemberships,
    createMembershipGroup,
    deleteMembershipGroup,
    refresh,
    clearError,
  };
}
