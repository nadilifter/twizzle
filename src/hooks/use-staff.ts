"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  MemberWithUser,
  MemberWithAvailability,
  MemberAvailability,
  CreateMemberPayload,
  UpdateMemberPayload,
  AvailabilityEntry,
} from "@/types/staff";

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = { data: MemberWithUser[]; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();
const profileCache = new Map<string, { data: MemberWithAvailability; fetchedAt: number }>();
const availabilityCache = new Map<string, { data: MemberAvailability[]; fetchedAt: number }>();

function staffKey(search: string): string {
  return JSON.stringify({ search });
}

function invalidateLists() {
  listCache.clear();
}

function invalidateProfile(id: string) {
  profileCache.delete(id);
}

interface UseStaffOptions {
  autoFetch?: boolean;
  search?: string;
}

interface UseStaffReturn {
  staff: MemberWithUser[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchStaff: (search?: string) => Promise<void>;
  createStaff: (data: CreateMemberPayload) => Promise<MemberWithUser | null>;
  updateStaff: (id: string, data: UpdateMemberPayload) => Promise<MemberWithUser | null>;
  deleteStaff: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useStaff(options: UseStaffOptions = {}): UseStaffReturn {
  const { autoFetch = true, search: initialSearch = "" } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = staffKey(initialSearch);
  const initialCached = listCache.get(initialKey);

  const [staff, setStaff] = useState<MemberWithUser[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSearch, setCurrentSearch] = useState(initialSearch);
  const currentSearchRef = useRef(initialSearch);

  const fetchStaff = useCallback(async (search?: string) => {
    const searchQuery = search ?? currentSearchRef.current;
    if (searchQuery !== currentSearchRef.current) {
      setCurrentSearch(searchQuery);
    }
    currentSearchRef.current = searchQuery;

    const key = staffKey(searchQuery);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await api.get<MemberWithUser[]>("/api/organization/staff", params);
      setStaff(response);
      listCache.set(key, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch staff";
      setError(message);
      console.error("Error fetching staff:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createStaff = useCallback(
    async (data: CreateMemberPayload): Promise<MemberWithUser | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newStaff = await api.post<MemberWithUser>("/api/organization/staff", data);
        setStaff((prev) => [...prev, newStaff]);
        invalidateLists();
        return newStaff;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create staff";
        setError(message);
        console.error("Error creating staff:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateStaff = useCallback(
    async (id: string, data: UpdateMemberPayload): Promise<MemberWithUser | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedStaff = await api.patch<MemberWithUser>(`/api/organization/staff/${id}`, data);
        setStaff((prev) => prev.map((s) => (s.id === id ? updatedStaff : s)));
        invalidateLists();
        invalidateProfile(id);
        return updatedStaff;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update staff";
        setError(message);
        console.error("Error updating staff:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteStaff = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/organization/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      invalidateLists();
      invalidateProfile(id);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete staff";
      setError(message);
      console.error("Error deleting staff:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchStaff(currentSearch);
  }, [fetchStaff, currentSearch]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = staffKey(initialSearch);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchStaff(initialSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    staff,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchStaff,
    createStaff,
    updateStaff,
    deleteStaff,
    refresh,
    clearError,
  };
}

// Hook for single member profile with availability
export function useMemberProfile(id: string | null) {
  const cached = id ? profileCache.get(id) : undefined;

  const [memberProfile, setMemberProfile] = useState<MemberWithAvailability | null>(
    () => cached?.data ?? null
  );
  const [isLoading, setIsLoading] = useState(() => !!id && !cached);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberProfile = useCallback(async () => {
    if (!id) return;
    const existing = profileCache.get(id);
    if (!existing) setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<MemberWithAvailability>(`/api/organization/staff/${id}`);
      setMemberProfile(data);
      profileCache.set(id, { data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch member profile";
      setError(message);
      console.error("Error fetching member profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setMemberProfile(null);
      return;
    }
    const existing = profileCache.get(id);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setMemberProfile(existing.data);
      return;
    }
    fetchMemberProfile();
  }, [id, fetchMemberProfile]);

  return {
    memberProfile,
    isLoading,
    error,
    fetchMemberProfile,
  };
}

/** @deprecated Use useMemberProfile */
export const useStaffProfile = useMemberProfile;

// Hook for member availability
export function useMemberAvailability(memberId: string | null) {
  const cached = memberId ? availabilityCache.get(memberId) : undefined;

  const [availability, setAvailability] = useState<MemberAvailability[]>(() => cached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !!memberId && !cached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!memberId) return;
    const existing = availabilityCache.get(memberId);
    if (!existing) setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<MemberAvailability[]>(
        `/api/organization/staff/${memberId}/availability`
      );
      setAvailability(data);
      availabilityCache.set(memberId, { data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch availability";
      setError(message);
      console.error("Error fetching availability:", err);
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  const saveAvailability = useCallback(
    async (entries: AvailabilityEntry[]): Promise<boolean> => {
      if (!memberId) return false;
      setIsSaving(true);
      setError(null);
      try {
        const data = await api.put<MemberAvailability[]>(
          `/api/organization/staff/${memberId}/availability`,
          entries
        );
        setAvailability(data);
        availabilityCache.set(memberId, { data, fetchedAt: Date.now() });
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to save availability";
        setError(message);
        console.error("Error saving availability:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [memberId]
  );

  useEffect(() => {
    if (!memberId) return;
    const existing = availabilityCache.get(memberId);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setAvailability(existing.data);
      return;
    }
    fetchAvailability();
  }, [memberId, fetchAvailability]);

  return {
    availability,
    isLoading,
    isSaving,
    error,
    fetchAvailability,
    saveAvailability,
  };
}

/** @deprecated Use useMemberAvailability */
export const useStaffAvailability = useMemberAvailability;
