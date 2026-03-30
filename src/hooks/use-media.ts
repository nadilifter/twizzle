"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  Media,
  MediaWithRelations,
  CreateMediaPayload,
  UpdateMediaPayload,
  MediaQueryParams,
} from "@/types/media";

interface MediaListResponse {
  data: MediaWithRelations[];
  total: number;
  limit: number;
  offset: number;
}

interface UseMediaOptions {
  autoFetch?: boolean;
  initialParams?: MediaQueryParams;
}

interface UseMediaReturn {
  media: MediaWithRelations[];
  total: number;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: string | null;
  fetchMedia: (params?: MediaQueryParams) => Promise<void>;
  createMedia: (data: CreateMediaPayload) => Promise<MediaWithRelations | null>;
  updateMedia: (id: string, data: UpdateMediaPayload) => Promise<MediaWithRelations | null>;
  deleteMedia: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useMedia(options: UseMediaOptions = {}): UseMediaReturn {
  const { autoFetch = true, initialParams = {} } = options;

  const [media, setMedia] = useState<MediaWithRelations[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentParams, setCurrentParamsState] = useState<MediaQueryParams>(initialParams);
  const currentParamsRef = useRef<MediaQueryParams>(initialParams);

  const setCurrentParams = useCallback((params: MediaQueryParams) => {
    currentParamsRef.current = params;
    setCurrentParamsState(params);
  }, []);

  const fetchMedia = useCallback(
    async (params?: MediaQueryParams) => {
      const queryParams = params ?? currentParamsRef.current;

      if (JSON.stringify(queryParams) !== JSON.stringify(currentParamsRef.current)) {
        setCurrentParams(queryParams);
      }
      currentParamsRef.current = queryParams;

      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<MediaListResponse>("/api/media", queryParams);
        setMedia(response.data);
        setTotal(response.total);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch media";
        setError(message);
        console.error("Error fetching media:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [setCurrentParams]
  );

  const createMedia = useCallback(
    async (data: CreateMediaPayload): Promise<MediaWithRelations | null> => {
      setIsCreating(true);
      setError(null);

      try {
        const newMedia = await api.post<MediaWithRelations>("/api/media", data);
        setMedia((prev) => [newMedia, ...prev]);
        setTotal((prev) => prev + 1);
        return newMedia;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to create media";
        setError(message);
        console.error("Error creating media:", err);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  const updateMedia = useCallback(
    async (id: string, data: UpdateMediaPayload): Promise<MediaWithRelations | null> => {
      setIsUpdating(true);
      setError(null);

      try {
        const updatedMedia = await api.patch<MediaWithRelations>(`/api/media/${id}`, data);
        setMedia((prev) => prev.map((item) => (item.id === id ? updatedMedia : item)));
        return updatedMedia;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to update media";
        setError(message);
        console.error("Error updating media:", err);
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    []
  );

  const deleteMedia = useCallback(async (id: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);

    try {
      await api.delete(`/api/media/${id}`);
      setMedia((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete media";
      setError(message);
      console.error("Error deleting media:", err);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchMedia(currentParams);
  }, [fetchMedia, currentParams]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchMedia(initialParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    media,
    total,
    isLoading,
    isCreating,
    isUpdating,
    isDeleting,
    error,
    fetchMedia,
    createMedia,
    updateMedia,
    deleteMedia,
    refresh,
    clearError,
  };
}

/**
 * Upload a file and create a media record
 */
export async function uploadAndCreateMedia(
  file: File,
  options: {
    type?: "IMAGE" | "VIDEO";
    title?: string;
    description?: string;
    athleteId?: string;
    eventId?: string;
  } = {}
): Promise<MediaWithRelations | null> {
  try {
    // First, upload the file
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "media");

    const uploadResponse = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file");
    }

    const { url } = await uploadResponse.json();

    // Determine media type from file
    const isVideo = file.type.startsWith("video/");
    const mediaType = options.type || (isVideo ? "VIDEO" : "IMAGE");

    // Create media record
    const media = await api.post<MediaWithRelations>("/api/media", {
      url,
      type: mediaType,
      title: options.title || file.name,
      description: options.description,
      athleteId: options.athleteId,
      eventId: options.eventId,
    });

    return media;
  } catch (err) {
    console.error("Error uploading and creating media:", err);
    return null;
  }
}
