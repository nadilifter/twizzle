"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  MedicalFormConfig,
  UpdateMedicalFormConfigPayload,
  CustomMedicalQuestion,
  CreateCustomMedicalQuestionPayload,
  UpdateCustomMedicalQuestionPayload,
  AthleteMedicalInfo,
  UpsertAthleteMedicalInfoPayload,
  AthleteMedicalInfoWithResponses,
} from "@/types/medical";

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
const CONFIG_CACHE_KEY = "config";
const configCache = new Map<string, { data: MedicalFormConfig; fetchedAt: number }>();

type QuestionsCacheEntry = { data: CustomMedicalQuestion[]; fetchedAt: number };
const questionsCache = new Map<string, QuestionsCacheEntry>();

interface AthleteMedicalCacheEntry {
  data: {
    medicalInfo: AthleteMedicalInfoWithResponses;
    customQuestions: CustomMedicalQuestion[];
    config: MedicalFormConfig;
  };
  fetchedAt: number;
}
const athleteMedicalCache = new Map<string, AthleteMedicalCacheEntry>();

function questionsKey(includeInactive: boolean): string {
  return JSON.stringify({ includeInactive });
}

function invalidateQuestions() {
  questionsCache.clear();
}

function invalidateAthleteMedical(athleteId: string) {
  athleteMedicalCache.delete(athleteId);
}

// ============================================
// Organization Medical Config Hook
// ============================================

interface UseMedicalConfigReturn {
  config: MedicalFormConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  updateConfig: (data: UpdateMedicalFormConfigPayload) => Promise<boolean>;
  clearError: () => void;
}

export function useMedicalConfig(): UseMedicalConfigReturn {
  const initialCached = configCache.get(CONFIG_CACHE_KEY);

  const [config, setConfig] = useState<MedicalFormConfig | null>(() => initialCached?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    const cached = configCache.get(CONFIG_CACHE_KEY);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<MedicalFormConfig>("/api/organization/medical-config");
      setConfig(response);
      configCache.set(CONFIG_CACHE_KEY, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical config";
      setError(message);
      console.error("Error fetching medical config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(
    async (data: UpdateMedicalFormConfigPayload): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.put<MedicalFormConfig>("/api/organization/medical-config", data);
        setConfig(response);
        configCache.set(CONFIG_CACHE_KEY, { data: response, fetchedAt: Date.now() });
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update medical config";
        setError(message);
        console.error("Error updating medical config:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const cached = configCache.get(CONFIG_CACHE_KEY);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchConfig();
  }, [fetchConfig]);

  return {
    config,
    isLoading,
    isSaving,
    error,
    fetchConfig,
    updateConfig,
    clearError,
  };
}

// ============================================
// Custom Medical Questions Hook
// ============================================

interface UseMedicalQuestionsReturn {
  questions: CustomMedicalQuestion[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchQuestions: (includeInactive?: boolean) => Promise<void>;
  createQuestion: (
    data: CreateCustomMedicalQuestionPayload
  ) => Promise<CustomMedicalQuestion | null>;
  updateQuestion: (
    id: string,
    data: UpdateCustomMedicalQuestionPayload
  ) => Promise<CustomMedicalQuestion | null>;
  deleteQuestion: (id: string) => Promise<boolean>;
  reorderQuestions: (questions: { id: string; displayOrder: number }[]) => Promise<boolean>;
  clearError: () => void;
}

export function useMedicalQuestions(): UseMedicalQuestionsReturn {
  const initialCached = questionsCache.get(questionsKey(false));

  const [questions, setQuestions] = useState<CustomMedicalQuestion[]>(
    () => initialCached?.data ?? []
  );
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (includeInactive = false) => {
    const key = questionsKey(includeInactive);
    const cached = questionsCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomMedicalQuestion[]>(
        "/api/organization/medical-questions",
        {
          includeInactive: includeInactive.toString(),
        }
      );
      setQuestions(response);
      questionsCache.set(key, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical questions";
      setError(message);
      console.error("Error fetching medical questions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createQuestion = useCallback(
    async (data: CreateCustomMedicalQuestionPayload): Promise<CustomMedicalQuestion | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.post<CustomMedicalQuestion>(
          "/api/organization/medical-questions",
          data
        );
        setQuestions((prev) => [...prev, response].sort((a, b) => a.displayOrder - b.displayOrder));
        invalidateQuestions();
        return response;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create question";
        setError(message);
        console.error("Error creating question:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const updateQuestion = useCallback(
    async (
      id: string,
      data: UpdateCustomMedicalQuestionPayload
    ): Promise<CustomMedicalQuestion | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.patch<CustomMedicalQuestion>(
          "/api/organization/medical-questions",
          { id, ...data }
        );
        setQuestions((prev) =>
          prev
            .map((q) => (q.id === id ? response : q))
            .sort((a, b) => a.displayOrder - b.displayOrder)
        );
        invalidateQuestions();
        return response;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update question";
        setError(message);
        console.error("Error updating question:", err);
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const deleteQuestion = useCallback(async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      await api.delete(`/api/organization/medical-questions?id=${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      invalidateQuestions();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete question";
      setError(message);
      console.error("Error deleting question:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reorderQuestions = useCallback(
    async (orderedQuestions: { id: string; displayOrder: number }[]): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.patch<CustomMedicalQuestion[]>(
          "/api/organization/medical-questions",
          {
            questions: orderedQuestions,
          }
        );
        setQuestions(response);
        invalidateQuestions();
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to reorder questions";
        setError(message);
        console.error("Error reordering questions:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    const key = questionsKey(false);
    const cached = questionsCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchQuestions();
  }, [fetchQuestions]);

  return {
    questions,
    isLoading,
    isSaving,
    error,
    fetchQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    clearError,
  };
}

// ============================================
// Athlete Medical Info Hook
// ============================================

interface AthleteMedicalResponse {
  medicalInfo: AthleteMedicalInfoWithResponses;
  customQuestions: CustomMedicalQuestion[];
  config: MedicalFormConfig;
}

interface UseAthleteMedicalInfoReturn {
  medicalInfo: AthleteMedicalInfoWithResponses | null;
  customQuestions: CustomMedicalQuestion[];
  config: MedicalFormConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchMedicalInfo: () => Promise<void>;
  saveMedicalInfo: (data: UpsertAthleteMedicalInfoPayload) => Promise<boolean>;
  clearError: () => void;
}

export function useAthleteMedicalInfo(athleteId: string | null): UseAthleteMedicalInfoReturn {
  const cached = athleteId ? athleteMedicalCache.get(athleteId) : undefined;

  const [medicalInfo, setMedicalInfo] = useState<AthleteMedicalInfoWithResponses | null>(
    () => cached?.data.medicalInfo ?? null
  );
  const [customQuestions, setCustomQuestions] = useState<CustomMedicalQuestion[]>(
    () => cached?.data.customQuestions ?? []
  );
  const [config, setConfig] = useState<MedicalFormConfig | null>(() => cached?.data.config ?? null);
  const [isLoading, setIsLoading] = useState(() => !!athleteId && !cached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicalInfo = useCallback(async () => {
    if (!athleteId) return;

    const existing = athleteMedicalCache.get(athleteId);
    if (!existing) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<AthleteMedicalResponse>(`/api/athletes/${athleteId}/medical`);
      setMedicalInfo(response.medicalInfo);
      setCustomQuestions(response.customQuestions);
      setConfig(response.config);
      athleteMedicalCache.set(athleteId, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical info";
      setError(message);
      console.error("Error fetching medical info:", err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  const saveMedicalInfo = useCallback(
    async (data: UpsertAthleteMedicalInfoPayload): Promise<boolean> => {
      if (!athleteId) return false;

      setIsSaving(true);
      setError(null);

      try {
        const response = await api.put<AthleteMedicalInfoWithResponses>(
          `/api/athletes/${athleteId}/medical`,
          data
        );
        setMedicalInfo(response);
        invalidateAthleteMedical(athleteId);
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to save medical info";
        setError(message);
        console.error("Error saving medical info:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [athleteId]
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (!athleteId) return;
    const existing = athleteMedicalCache.get(athleteId);
    const isFresh = existing && Date.now() - existing.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setMedicalInfo(existing.data.medicalInfo);
      setCustomQuestions(existing.data.customQuestions);
      setConfig(existing.data.config);
      return;
    }
    fetchMedicalInfo();
  }, [athleteId, fetchMedicalInfo]);

  return {
    medicalInfo,
    customQuestions,
    config,
    isLoading,
    isSaving,
    error,
    fetchMedicalInfo,
    saveMedicalInfo,
    clearError,
  };
}

// ============================================
// Public Medical Info Hook (for checkout flow)
// ============================================

interface UsePublicAthleteMedicalInfoReturn {
  medicalInfo: AthleteMedicalInfoWithResponses | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchMedicalInfo: () => Promise<void>;
  saveMedicalInfo: (data: UpsertAthleteMedicalInfoPayload) => Promise<boolean>;
  clearError: () => void;
}

export function usePublicAthleteMedicalInfo(
  athleteId: string | null,
  organizationId: string | null,
  email: string | null
): UsePublicAthleteMedicalInfoReturn {
  const [medicalInfo, setMedicalInfo] = useState<AthleteMedicalInfoWithResponses | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicalInfo = useCallback(async () => {
    if (!athleteId || !organizationId || !email) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/public/athletes/${athleteId}/medical?organizationId=${organizationId}&email=${encodeURIComponent(email)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch medical info");
      }

      const data = await response.json();
      setMedicalInfo(data.medicalInfo?.id ? data.medicalInfo : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch medical info";
      setError(message);
      console.error("Error fetching public medical info:", err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId, organizationId, email]);

  const saveMedicalInfo = useCallback(
    async (data: UpsertAthleteMedicalInfoPayload): Promise<boolean> => {
      if (!athleteId || !organizationId || !email) return false;

      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/public/athletes/${athleteId}/medical`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            organizationId,
            email,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save medical info");
        }

        const result = await response.json();
        setMedicalInfo(result.medicalInfo);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save medical info";
        setError(message);
        console.error("Error saving public medical info:", err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [athleteId, organizationId, email]
  );

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (athleteId && organizationId && email) {
      fetchMedicalInfo();
    }
  }, [athleteId, organizationId, email, fetchMedicalInfo]);

  return {
    medicalInfo,
    isLoading,
    isSaving,
    error,
    fetchMedicalInfo,
    saveMedicalInfo,
    clearError,
  };
}
