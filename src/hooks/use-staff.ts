"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  StaffProfileWithUser,
  StaffProfileWithAvailability,
  StaffAvailability,
  CreateStaffPayload,
  UpdateStaffPayload,
  AvailabilityEntry,
} from "@/types/staff";

interface UseStaffOptions {
  autoFetch?: boolean;
  search?: string;
}

interface UseStaffReturn {
  staff: StaffProfileWithUser[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchStaff: (search?: string) => Promise<void>;
  createStaff: (data: CreateStaffPayload) => Promise<StaffProfileWithUser | null>;
  updateStaff: (id: string, data: UpdateStaffPayload) => Promise<StaffProfileWithUser | null>;
  deleteStaff: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useStaff(options: UseStaffOptions = {}): UseStaffReturn {
  const { autoFetch = true, search: initialSearch = "" } = options;

  const [staff, setStaff] = useState<StaffProfileWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

    setIsLoading(true);
    setError(null);

    try {
      const params = searchQuery ? { search: searchQuery } : {};
      const response = await api.get<StaffProfileWithUser[]>("/api/organization/staff", params);
      setStaff(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch staff";
      setError(message);
      console.error("Error fetching staff:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createStaff = useCallback(async (data: CreateStaffPayload): Promise<StaffProfileWithUser | null> => {
    setIsCreating(true);
    setError(null);

    try {
      const newStaff = await api.post<StaffProfileWithUser>("/api/organization/staff", data);
      setStaff((prev) => [...prev, newStaff]);
      return newStaff;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create staff";
      setError(message);
      console.error("Error creating staff:", err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateStaff = useCallback(async (
    id: string,
    data: UpdateStaffPayload
  ): Promise<StaffProfileWithUser | null> => {
    setIsUpdating(true);
    setError(null);

    try {
      const updatedStaff = await api.patch<StaffProfileWithUser>(`/api/organization/staff/${id}`, data);
      setStaff((prev) =>
        prev.map((s) => (s.id === id ? updatedStaff : s))
      );
      return updatedStaff;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update staff";
      setError(message);
      console.error("Error updating staff:", err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const deleteStaff = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/organization/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
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
    if (autoFetch) {
      fetchStaff(initialSearch);
    }
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

// Hook for single staff profile with availability
export function useStaffProfile(id: string | null) {
  const [staffProfile, setStaffProfile] = useState<StaffProfileWithAvailability | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStaffProfile = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<StaffProfileWithAvailability>(`/api/organization/staff/${id}`);
      setStaffProfile(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch staff profile";
      setError(message);
      console.error("Error fetching staff profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStaffProfile();
  }, [fetchStaffProfile]);

  return {
    staffProfile,
    isLoading,
    error,
    fetchStaffProfile,
  };
}

// Hook for staff availability
export function useStaffAvailability(staffProfileId: string | null) {
  const [availability, setAvailability] = useState<StaffAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!staffProfileId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<StaffAvailability[]>(`/api/organization/staff/${staffProfileId}/availability`);
      setAvailability(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch availability";
      setError(message);
      console.error("Error fetching availability:", err);
    } finally {
      setIsLoading(false);
    }
  }, [staffProfileId]);

  const saveAvailability = useCallback(async (entries: AvailabilityEntry[]): Promise<boolean> => {
    if (!staffProfileId) return false;
    setIsSaving(true);
    setError(null);
    try {
      const data = await api.put<StaffAvailability[]>(`/api/organization/staff/${staffProfileId}/availability`, entries);
      setAvailability(data);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save availability";
      setError(message);
      console.error("Error saving availability:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [staffProfileId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    availability,
    isLoading,
    isSaving,
    error,
    fetchAvailability,
    saveAvailability,
  };
}
