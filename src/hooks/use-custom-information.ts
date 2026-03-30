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
  const [config, setConfig] = useState<CustomInfoConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomInfoConfig>(
        "/api/organization/custom-information/config"
      );
      setConfig(response);
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
  const [questions, setQuestions] = useState<CustomInfoQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (includeInactive = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomInfoQuestion[]>(
        "/api/organization/custom-information/questions",
        {
          includeInactive: includeInactive.toString(),
        }
      );
      setQuestions(response);
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
