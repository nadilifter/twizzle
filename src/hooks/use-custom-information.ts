"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  CustomInfoConfig,
  UpdateCustomInfoConfigPayload,
  CustomInfoQuestion,
  CreateCustomInfoQuestionPayload,
  UpdateCustomInfoQuestionPayload,
} from "@/types/custom-information";

// Module-level stale-while-revalidate caches.
const LIST_CACHE_TTL_MS = 60_000;
const CONFIG_CACHE_KEY = "config";
const configCache = new Map<string, { data: CustomInfoConfig; fetchedAt: number }>();

type QuestionsCacheEntry = { data: CustomInfoQuestion[]; fetchedAt: number };
const questionsCache = new Map<string, QuestionsCacheEntry>();

function questionsKey(includeInactive: boolean): string {
  return JSON.stringify({ includeInactive });
}

function invalidateQuestions() {
  questionsCache.clear();
}

// ============================================
// Organization Custom Info Config Hook
// ============================================

interface UseCustomInfoConfigReturn {
  config: CustomInfoConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchConfig: () => Promise<void>;
  updateConfig: (data: UpdateCustomInfoConfigPayload) => Promise<boolean>;
  clearError: () => void;
}

export function useCustomInfoConfig(): UseCustomInfoConfigReturn {
  const initialCached = configCache.get(CONFIG_CACHE_KEY);

  const [config, setConfig] = useState<CustomInfoConfig | null>(() => initialCached?.data ?? null);
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    const cached = configCache.get(CONFIG_CACHE_KEY);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomInfoConfig>(
        "/api/organization/custom-information/config"
      );
      setConfig(response);
      configCache.set(CONFIG_CACHE_KEY, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch config";
      setError(message);
      console.error("Error fetching custom info config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(
    async (data: UpdateCustomInfoConfigPayload): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.put<CustomInfoConfig>(
          "/api/organization/custom-information/config",
          data
        );
        setConfig(response);
        configCache.set(CONFIG_CACHE_KEY, { data: response, fetchedAt: Date.now() });
        return true;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update config";
        setError(message);
        console.error("Error updating custom info config:", err);
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

  return { config, isLoading, isSaving, error, fetchConfig, updateConfig, clearError };
}

// ============================================
// Custom Info Questions Hook
// ============================================

interface UseCustomInfoQuestionsReturn {
  questions: CustomInfoQuestion[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  fetchQuestions: (includeInactive?: boolean) => Promise<void>;
  createQuestion: (data: CreateCustomInfoQuestionPayload) => Promise<CustomInfoQuestion | null>;
  updateQuestion: (
    id: string,
    data: UpdateCustomInfoQuestionPayload
  ) => Promise<CustomInfoQuestion | null>;
  deleteQuestion: (id: string) => Promise<boolean>;
  reorderQuestions: (questions: { id: string; displayOrder: number }[]) => Promise<boolean>;
  clearError: () => void;
}

export function useCustomInfoQuestions(): UseCustomInfoQuestionsReturn {
  const initialCached = questionsCache.get(questionsKey(false));

  const [questions, setQuestions] = useState<CustomInfoQuestion[]>(() => initialCached?.data ?? []);
  const [isLoading, setIsLoading] = useState(() => !initialCached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (includeInactive = false) => {
    const key = questionsKey(includeInactive);
    const cached = questionsCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomInfoQuestion[]>(
        "/api/organization/custom-information/questions",
        {
          includeInactive: includeInactive.toString(),
        }
      );
      setQuestions(response);
      questionsCache.set(key, { data: response, fetchedAt: Date.now() });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch questions";
      setError(message);
      console.error("Error fetching custom info questions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createQuestion = useCallback(
    async (data: CreateCustomInfoQuestionPayload): Promise<CustomInfoQuestion | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.post<CustomInfoQuestion>(
          "/api/organization/custom-information/questions",
          data
        );
        setQuestions((prev) => [...prev, response].sort((a, b) => a.displayOrder - b.displayOrder));
        invalidateQuestions();
        return response;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create question";
        setError(message);
        console.error("Error creating custom info question:", err);
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
      data: UpdateCustomInfoQuestionPayload
    ): Promise<CustomInfoQuestion | null> => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await api.patch<CustomInfoQuestion>(
          "/api/organization/custom-information/questions",
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
        console.error("Error updating custom info question:", err);
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
      await api.delete(`/api/organization/custom-information/questions?id=${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      invalidateQuestions();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete question";
      setError(message);
      console.error("Error deleting custom info question:", err);
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
        const response = await api.patch<CustomInfoQuestion[]>(
          "/api/organization/custom-information/questions",
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
        console.error("Error reordering custom info questions:", err);
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
