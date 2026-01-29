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
  const [config, setConfig] = useState<MedicalFormConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<MedicalFormConfig>("/api/organization/medical-config");
      setConfig(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical config";
      setError(message);
      console.error("Error fetching medical config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (data: UpdateMedicalFormConfigPayload): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.put<MedicalFormConfig>("/api/organization/medical-config", data);
      setConfig(response);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update medical config";
      setError(message);
      console.error("Error updating medical config:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
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
  createQuestion: (data: CreateCustomMedicalQuestionPayload) => Promise<CustomMedicalQuestion | null>;
  updateQuestion: (id: string, data: UpdateCustomMedicalQuestionPayload) => Promise<CustomMedicalQuestion | null>;
  deleteQuestion: (id: string) => Promise<boolean>;
  reorderQuestions: (questions: { id: string; displayOrder: number }[]) => Promise<boolean>;
  clearError: () => void;
}

export function useMedicalQuestions(): UseMedicalQuestionsReturn {
  const [questions, setQuestions] = useState<CustomMedicalQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async (includeInactive = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CustomMedicalQuestion[]>("/api/organization/medical-questions", {
        includeInactive: includeInactive.toString(),
      });
      setQuestions(response);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical questions";
      setError(message);
      console.error("Error fetching medical questions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createQuestion = useCallback(async (data: CreateCustomMedicalQuestionPayload): Promise<CustomMedicalQuestion | null> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.post<CustomMedicalQuestion>("/api/organization/medical-questions", data);
      setQuestions((prev) => [...prev, response].sort((a, b) => a.displayOrder - b.displayOrder));
      return response;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create question";
      setError(message);
      console.error("Error creating question:", err);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateQuestion = useCallback(async (id: string, data: UpdateCustomMedicalQuestionPayload): Promise<CustomMedicalQuestion | null> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.patch<CustomMedicalQuestion>("/api/organization/medical-questions", { id, ...data });
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? response : q)).sort((a, b) => a.displayOrder - b.displayOrder)
      );
      return response;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update question";
      setError(message);
      console.error("Error updating question:", err);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteQuestion = useCallback(async (id: string): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      await api.delete(`/api/organization/medical-questions?id=${id}`);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
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

  const reorderQuestions = useCallback(async (orderedQuestions: { id: string; displayOrder: number }[]): Promise<boolean> => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.patch<CustomMedicalQuestion[]>("/api/organization/medical-questions", {
        questions: orderedQuestions,
      });
      setQuestions(response);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to reorder questions";
      setError(message);
      console.error("Error reordering questions:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

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
  const [medicalInfo, setMedicalInfo] = useState<AthleteMedicalInfoWithResponses | null>(null);
  const [customQuestions, setCustomQuestions] = useState<CustomMedicalQuestion[]>([]);
  const [config, setConfig] = useState<MedicalFormConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicalInfo = useCallback(async () => {
    if (!athleteId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<AthleteMedicalResponse>(`/api/athletes/${athleteId}/medical`);
      setMedicalInfo(response.medicalInfo);
      setCustomQuestions(response.customQuestions);
      setConfig(response.config);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch medical info";
      setError(message);
      console.error("Error fetching medical info:", err);
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  const saveMedicalInfo = useCallback(async (data: UpsertAthleteMedicalInfoPayload): Promise<boolean> => {
    if (!athleteId) return false;

    setIsSaving(true);
    setError(null);

    try {
      const response = await api.put<AthleteMedicalInfoWithResponses>(`/api/athletes/${athleteId}/medical`, data);
      setMedicalInfo(response);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save medical info";
      setError(message);
      console.error("Error saving medical info:", err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [athleteId]);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (athleteId) {
      fetchMedicalInfo();
    }
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
