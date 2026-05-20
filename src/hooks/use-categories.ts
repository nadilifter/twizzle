"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    programs: number;
    events: number;
    competitions: number;
  };
}

export interface AllProgramsMeta {
  imageUrl: string | null;
  _count: {
    programs: number;
    events: number;
    competitions: number;
  };
}

interface CategoriesListResponse {
  data: Category[];
  allPrograms?: AllProgramsMeta;
}

interface CategoriesQueryParams {
  search?: string;
}

interface CreateCategoryPayload {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface UseCategoriesOptions {
  autoFetch?: boolean;
  initialParams?: CategoriesQueryParams;
}

interface UseCategoriesReturn {
  categories: Category[];
  allPrograms: AllProgramsMeta | null;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchCategories: (params?: CategoriesQueryParams) => Promise<void>;
  createCategory: (data: CreateCategoryPayload) => Promise<Category | null>;
  updateCategory: (id: string, data: UpdateCategoryPayload) => Promise<Category | null>;
  deleteCategory: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

// Module-level stale-while-revalidate cache for the list query.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = {
  categories: Category[];
  allPrograms: AllProgramsMeta | null;
  fetchedAt: number;
};
const listCache = new Map<string, ListCacheEntry>();

function paramsKey(params: CategoriesQueryParams): string {
  return JSON.stringify(params ?? {});
}

function invalidateLists() {
  listCache.clear();
}

export function useCategories(options: UseCategoriesOptions = {}): UseCategoriesReturn {
  const { autoFetch = true, initialParams = {} } = options;

  // Seed state from cache so revisits render instantly with no spinner.
  const initialKey = paramsKey(initialParams);
  const initialCached = listCache.get(initialKey);

  const [categories, setCategories] = useState<Category[]>(() => initialCached?.categories ?? []);
  const [allPrograms, setAllPrograms] = useState<AllProgramsMeta | null>(
    () => initialCached?.allPrograms ?? null
  );
  const [isLoading, setIsLoading] = useState(() => autoFetch && !initialCached);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParams] = useState<CategoriesQueryParams>(initialParams);

  const currentParamsRef = useRef<CategoriesQueryParams>(initialParams);

  useEffect(() => {
    currentParamsRef.current = currentParams;
  }, [currentParams]);

  const fetchCategories = useCallback(async (params?: CategoriesQueryParams) => {
    const queryParams = params ?? currentParamsRef.current;

    if (params) {
      setCurrentParams(queryParams);
    }

    const key = paramsKey(queryParams);
    const cached = listCache.get(key);
    if (!cached) setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<CategoriesListResponse>("/api/categories", queryParams);
      setCategories(response.data);
      setAllPrograms(response.allPrograms ?? null);
      listCache.set(key, {
        categories: response.data,
        allPrograms: response.allPrograms ?? null,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch categories";
      setError(message);
      console.error("Error fetching categories:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategory = useCallback(
    async (data: CreateCategoryPayload): Promise<Category | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newCategory = await api.post<Category>("/api/categories", data);
        setCategories((prev) => [...prev, newCategory]);
        invalidateLists();
        return newCategory;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create category";
        setError(message);
        console.error("Error creating category:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateCategory = useCallback(
    async (id: string, data: UpdateCategoryPayload): Promise<Category | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedCategory = await api.patch<Category>(`/api/categories/${id}`, data);
        setCategories((prev) => prev.map((cat) => (cat.id === id ? updatedCategory : cat)));
        invalidateLists();
        return updatedCategory;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update category";
        setError(message);
        console.error("Error updating category:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/categories/${id}`);
      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      invalidateLists();
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete category";
      setError(message);
      console.error("Error deleting category:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchCategories(currentParams);
  }, [fetchCategories, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!autoFetch) return;
    const key = paramsKey(initialParams);
    const cached = listCache.get(key);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) return;
    fetchCategories(initialParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    categories,
    allPrograms,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh,
    clearError,
  };
}
