"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  ShiftWithRelations,
  ScheduleTemplateWithEntries,
  CreateShiftPayload,
  UpdateShiftPayload,
  ShiftsQueryParams,
  CreateScheduleTemplatePayload,
  UpdateScheduleTemplatePayload,
  GenerateShiftsPayload,
  GenerateShiftsResponse,
} from "@/types/staff";

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
type ShiftsListCacheEntry = { data: ShiftWithRelations[]; fetchedAt: number };
const shiftsListCache = new Map<string, ShiftsListCacheEntry>();
type TemplatesListCacheEntry = { data: ScheduleTemplateWithEntries[]; fetchedAt: number };
const templatesListCache = new Map<string, TemplatesListCacheEntry>();

function shiftsKey(params: ShiftsQueryParams): string {
  return JSON.stringify(params ?? {});
}

function templatesKey(isActive?: boolean): string {
  return JSON.stringify({ isActive });
}

function invalidateShifts() {
  shiftsListCache.clear();
}

function invalidateTemplates() {
  templatesListCache.clear();
}

// ============================================
// Shifts Hook
// ============================================

interface UseShiftsOptions {
  autoFetch?: boolean;
  initialParams?: ShiftsQueryParams;
}

interface UseShiftsReturn {
  shifts: ShiftWithRelations[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchShifts: (params?: ShiftsQueryParams) => Promise<void>;
  createShift: (data: CreateShiftPayload) => Promise<ShiftWithRelations | null>;
  updateShift: (id: string, data: UpdateShiftPayload) => Promise<ShiftWithRelations | null>;
  deleteShift: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useShifts(options: UseShiftsOptions = {}): UseShiftsReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = shiftsKey(initialParams);
  const initialCached = shiftsListCache.get(initialKey);

  const [shifts, setShifts] = useState<ShiftWithRelations[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParamsState] = useState<ShiftsQueryParams>(initialParams);
  const currentParamsRef = useRef<ShiftsQueryParams>(initialParams);

  const setCurrentParams = useCallback((params: ShiftsQueryParams) => {
    currentParamsRef.current = params;
    setCurrentParamsState(params);
  }, []);

  const fetchShifts = useCallback(
    async (params?: ShiftsQueryParams) => {
      const queryParams = params ?? currentParamsRef.current;

      if (JSON.stringify(queryParams) !== JSON.stringify(currentParamsRef.current)) {
        setCurrentParams(queryParams);
      }
      currentParamsRef.current = queryParams;

      const key = shiftsKey(queryParams);
      const cached = shiftsListCache.get(key);
      if (!cached) setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<ShiftWithRelations[]>(
          "/api/organization/shifts",
          queryParams
        );
        setShifts(response);
        shiftsListCache.set(key, { data: response, fetchedAt: Date.now() });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch shifts";
        setError(message);
        console.error("Error fetching shifts:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [setCurrentParams]
  );

  const createShift = useCallback(
    async (data: CreateShiftPayload): Promise<ShiftWithRelations | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newShift = await api.post<ShiftWithRelations>("/api/organization/shifts", data);
        setShifts((prev) =>
          [...prev, newShift].sort(
            (a, b) =>
              new Date(a.date).getTime() - new Date(b.date).getTime() ||
              a.startTime.localeCompare(b.startTime)
          )
        );
        invalidateShifts();
        return newShift;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create shift";
        setError(message);
        console.error("Error creating shift:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateShift = useCallback(
    async (id: string, data: UpdateShiftPayload): Promise<ShiftWithRelations | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedShift = await api.patch<ShiftWithRelations>(
          `/api/organization/shifts/${id}`,
          data
        );
        setShifts((prev) => prev.map((s) => (s.id === id ? updatedShift : s)));
        invalidateShifts();
        return updatedShift;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update shift";
        setError(message);
        console.error("Error updating shift:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteShift = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/organization/shifts/${id}`);
      setShifts((prev) => prev.filter((s) => s.id !== id));
      invalidateShifts();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete shift";
      setError(message);
      console.error("Error deleting shift:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchShifts(currentParams);
  }, [fetchShifts, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = shiftsKey(initialParams);
    const cached = shiftsListCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchShifts(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    shifts,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchShifts,
    createShift,
    updateShift,
    deleteShift,
    refresh,
    clearError,
  };
}

// ============================================
// Schedule Templates Hook
// ============================================

interface UseScheduleTemplatesOptions {
  autoFetch?: boolean;
  isActive?: boolean;
}

interface UseScheduleTemplatesReturn {
  templates: ScheduleTemplateWithEntries[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isGenerating: boolean;
  error: string | null;
  fetchTemplates: (isActive?: boolean) => Promise<void>;
  createTemplate: (
    data: CreateScheduleTemplatePayload
  ) => Promise<ScheduleTemplateWithEntries | null>;
  updateTemplate: (
    id: string,
    data: UpdateScheduleTemplatePayload
  ) => Promise<ScheduleTemplateWithEntries | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
  generateShifts: (
    templateId: string,
    data: GenerateShiftsPayload
  ) => Promise<GenerateShiftsResponse | null>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useScheduleTemplates(
  options: UseScheduleTemplatesOptions = {}
): UseScheduleTemplatesReturn {
  const { autoFetch = true, isActive } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = templatesKey(isActive);
  const initialCached = templatesListCache.get(initialKey);

  const [templates, setTemplates] = useState<ScheduleTemplateWithEntries[]>(
    () => initialCached?.data ?? []
  );
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async (activeFilter?: boolean) => {
    const key = templatesKey(activeFilter);
    const cached = templatesListCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const params = activeFilter !== undefined ? { isActive: String(activeFilter) } : {};
      const response = await api.get<ScheduleTemplateWithEntries[]>(
        "/api/organization/schedule-templates",
        params
      );
      setTemplates(response);
      templatesListCache.set(key, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch schedule templates";
      setError(message);
      console.error("Error fetching schedule templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTemplate = useCallback(
    async (data: CreateScheduleTemplatePayload): Promise<ScheduleTemplateWithEntries | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newTemplate = await api.post<ScheduleTemplateWithEntries>(
          "/api/organization/schedule-templates",
          data
        );
        setTemplates((prev) => [...prev, newTemplate]);
        invalidateTemplates();
        return newTemplate;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to create schedule template";
        setError(message);
        console.error("Error creating schedule template:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateTemplate = useCallback(
    async (
      id: string,
      data: UpdateScheduleTemplatePayload
    ): Promise<ScheduleTemplateWithEntries | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedTemplate = await api.patch<ScheduleTemplateWithEntries>(
          `/api/organization/schedule-templates/${id}`,
          data
        );
        setTemplates((prev) => prev.map((t) => (t.id === id ? updatedTemplate : t)));
        invalidateTemplates();
        return updatedTemplate;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to update schedule template";
        setError(message);
        console.error("Error updating schedule template:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteTemplate = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/organization/schedule-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      invalidateTemplates();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete schedule template";
      setError(message);
      console.error("Error deleting schedule template:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const generateShifts = useCallback(
    async (
      templateId: string,
      data: GenerateShiftsPayload
    ): Promise<GenerateShiftsResponse | null> => {
      setIsGenerating(true);
      setError(null);

      try {
        const response = await api.post<GenerateShiftsResponse>(
          `/api/organization/schedule-templates/${templateId}/generate`,
          data
        );
        invalidateShifts();
        return response;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to generate shifts";
        setError(message);
        console.error("Error generating shifts:", err);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const refresh = useCallback(async () => {
    await fetchTemplates(isActive);
  }, [fetchTemplates, isActive]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = templatesKey(isActive);
    const cached = templatesListCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchTemplates(isActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    templates,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    isGenerating,
    error,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    generateShifts,
    refresh,
    clearError,
  };
}
