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

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  data: MembershipGroup[];
  total: number;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: MembershipsQueryParams): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

/**
 * Hook for managing memberships list data and CRUD operations
 */
export function useMemberships(options: UseMembershipsOptions = {}): UseMembershipsReturn {
  const { autoFetch = true, initialParams = {} } = options;
  const { data: session } = useSession();

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  // State
  const [memberships, setMemberships] = useState<MembershipGroup[]>(
    () => initialCached?.data ?? []
  );
  const [total, setTotal] = useState(() => initialCached?.total ?? 0);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentParamsRef = useRef<MembershipsQueryParams>(initialParams);

  const fetchMemberships = useCallback(async (params?: MembershipsQueryParams) => {
    const queryParams = params ?? currentParamsRef.current;
    currentParamsRef.current = queryParams;

    const key = paramsKey(queryParams);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<MembershipGroupsListResponse>("/api/memberships", queryParams);
      setMemberships(response.data);
      setTotal(response.total);
      listCache.set(key, {
        data: response.data,
        total: response.total,
        fetchedAt: Date.now(),
      });
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
        invalidateLists();
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
      invalidateLists();
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
    if (!autoFetch || !session?.user?.organizationId) return;
    const key = paramsKey(initialParams);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchMemberships(initialParams);
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
