"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  FacilityListItem,
  FacilityDetail,
  CreateFacilityPayload,
  UpdateFacilityPayload,
  FacilityNote,
  FacilityActivityPage,
  FacilityActivitySort,
  FacilityActivityType,
} from "@/types/facilities";

const BASE = "/api/organization/facilities";

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
const LIST_CACHE_KEY = "facilities";
type ListCacheEntry = { data: FacilityListItem[]; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();

const detailCache = new Map<string, { data: FacilityDetail; fetchedAt: number }>();
const notesCache = new Map<string, { data: FacilityNote[]; fetchedAt: number }>();

function invalidateLists() {
  listCache.clear();
}

function invalidateDetail(id: string) {
  detailCache.delete(id);
}

function invalidateNotes(id: string) {
  notesCache.delete(id);
}

// ---------------------------------------------------------------------------
// useFacilities — list hook
// ---------------------------------------------------------------------------

interface UseFacilitiesReturn {
  facilities: FacilityListItem[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  fetchFacilities: () => Promise<void>;
  createFacility: (data: CreateFacilityPayload) => Promise<FacilityListItem | null>;
  deleteFacility: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useFacilities(): UseFacilitiesReturn {
  const initialCached = listCache.get(LIST_CACHE_KEY);

  const [facilities, setFacilities] = useState<FacilityListItem[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFacilities = useCallback(async () => {
    const cached = listCache.get(LIST_CACHE_KEY);
    if (!cached) setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<FacilityListItem[]>(BASE);
      setFacilities(data);
      listCache.set(LIST_CACHE_KEY, { data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch facilities";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createFacility = useCallback(
    async (data: CreateFacilityPayload): Promise<FacilityListItem | null> => {
      setIsCreating(true);
      setError(null);
      try {
        const created = await api.post<FacilityListItem>(BASE, data);
        setFacilities((prev) => [...prev, created]);
        invalidateLists();
        return created;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create facility";
        setError(message);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const deleteFacility = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    try {
      await api.delete(`${BASE}/${id}`);
      setFacilities((prev) => prev.filter((f) => f.id !== id));
      invalidateLists();
      invalidateDetail(id);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete facility";
      setError(message);
      return false;
    }
  }, []);

  const refresh = useCallback(() => fetchFacilities(), [fetchFacilities]);
  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const cached = listCache.get(LIST_CACHE_KEY);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchFacilities();
  }, [fetchFacilities]);

  return {
    facilities,
    isLoading,
    isCreating,
    error,
    fetchFacilities,
    createFacility,
    deleteFacility,
    refresh,
    clearError,
  };
}

// ---------------------------------------------------------------------------
// useFacility — single facility hook for the detail page
// ---------------------------------------------------------------------------

interface UseFacilityReturn {
  facility: FacilityDetail | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  fetchFacility: () => Promise<void>;
  updateFacility: (data: UpdateFacilityPayload) => Promise<FacilityDetail | null>;
  clearError: () => void;
}

export function useFacility(facilityId: string | null): UseFacilityReturn {
  const cached = facilityId ? detailCache.get(facilityId) : undefined;

  const [facility, setFacility] = useState<FacilityDetail | null>(() => cached?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !!facilityId && !cached);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFacility = useCallback(async () => {
    if (!facilityId) return;
    const existing = detailCache.get(facilityId);
    if (!existing) setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<FacilityDetail>(`${BASE}/${facilityId}`);
      setFacility(data);
      detailCache.set(facilityId, { data, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch facility";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId]);

  const updateFacility = useCallback(
    async (data: UpdateFacilityPayload): Promise<FacilityDetail | null> => {
      if (!facilityId) return null;
      setIsUpdating(true);
      setError(null);
      try {
        const updated = await api.patch<FacilityDetail>(`${BASE}/${facilityId}`, data);
        setFacility(updated);
        detailCache.set(facilityId, { data: updated, fetchedAt: Date.now() });
        invalidateLists();
        return updated;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update facility";
        setError(message);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [facilityId]
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!facilityId) {
      setFacility(null);
      return;
    }
    const existing = detailCache.get(facilityId);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setFacility(existing.data);
      return;
    }
    fetchFacility();
  }, [facilityId, fetchFacility]);

  return { facility, isLoading, isUpdating, error, fetchFacility, updateFacility, clearError };
}

// ---------------------------------------------------------------------------
// useFacilityNotes
// ---------------------------------------------------------------------------

interface UseFacilityNotesReturn {
  notes: FacilityNote[];
  isLoading: boolean;
  isCreating: boolean;
  fetchNotes: () => Promise<void>;
  createNote: (content: string) => Promise<FacilityNote | null>;
  updateNote: (noteId: string, content: string) => Promise<FacilityNote | null>;
  deleteNote: (noteId: string) => Promise<boolean>;
}

export function useFacilityNotes(facilityId: string | null): UseFacilityNotesReturn {
  const cached = facilityId ? notesCache.get(facilityId) : undefined;

  const [notes, setNotes] = useState<FacilityNote[]>(() => cached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !!facilityId && !cached);
  const [isCreating, setIsCreating] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!facilityId) return;
    const existing = notesCache.get(facilityId);
    if (!existing) setIsLoading(true);
    try {
      const data = await api.get<FacilityNote[]>(`${BASE}/${facilityId}/notes`);
      setNotes(data);
      notesCache.set(facilityId, { data, fetchedAt: Date.now() });
    } catch {
      // Silently fail — notes are non-critical
    } finally {
      setIsLoading(false);
    }
  }, [facilityId]);

  const createNote = useCallback(
    async (content: string): Promise<FacilityNote | null> => {
      if (!facilityId) return null;
      setIsCreating(true);
      try {
        const note = await api.post<FacilityNote>(`${BASE}/${facilityId}/notes`, { content });
        setNotes((prev) => [note, ...prev]);
        invalidateNotes(facilityId);
        return note;
      } catch {
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [facilityId]
  );

  const updateNote = useCallback(
    async (noteId: string, content: string): Promise<FacilityNote | null> => {
      if (!facilityId) return null;
      try {
        const updated = await api.patch<FacilityNote>(`${BASE}/${facilityId}/notes/${noteId}`, {
          content,
        });
        setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
        invalidateNotes(facilityId);
        return updated;
      } catch {
        return null;
      }
    },
    [facilityId]
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<boolean> => {
      if (!facilityId) return false;
      try {
        await api.delete(`${BASE}/${facilityId}/notes/${noteId}`);
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        invalidateNotes(facilityId);
        return true;
      } catch {
        return false;
      }
    },
    [facilityId]
  );

  useEffect(() => {
    if (!facilityId) return;
    const existing = notesCache.get(facilityId);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setNotes(existing.data);
      return;
    }
    fetchNotes();
  }, [facilityId, fetchNotes]);

  return { notes, isLoading, isCreating, fetchNotes, createNote, updateNote, deleteNote };
}

// ---------------------------------------------------------------------------
// useFacilityActivity
// ---------------------------------------------------------------------------

export interface FacilityActivityQuery {
  page: number;
  pageSize: number;
  sort: FacilityActivitySort;
  /** Empty array = all activity types */
  types: FacilityActivityType[];
  q: string;
}

interface UseFacilityActivityReturn {
  data: FacilityActivityPage | null;
  isLoading: boolean;
  fetchActivity: () => Promise<void>;
}

export function useFacilityActivity(
  facilityId: string | null,
  query: FacilityActivityQuery
): UseFacilityActivityReturn {
  const [data, setData] = useState<FacilityActivityPage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    if (!facilityId) return;
    setIsLoading(true);
    try {
      const q = query.q.trim();
      const params: Record<string, string | number> = {
        page: query.page,
        pageSize: query.pageSize,
        sort: query.sort,
      };
      if (query.types.length > 0) {
        params.types = query.types.join(",");
      }
      if (q) {
        params.q = q;
      }
      const result = await api.get<FacilityActivityPage>(`${BASE}/${facilityId}/activity`, params);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, query.page, query.pageSize, query.sort, query.types, query.q]);

  useEffect(() => {
    if (facilityId) {
      void fetchActivity();
    } else {
      setData(null);
    }
  }, [facilityId, fetchActivity]);

  return { data, isLoading, fetchActivity };
}
