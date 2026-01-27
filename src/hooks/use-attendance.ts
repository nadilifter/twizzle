"use client";

import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  AttendanceWithRelations,
  AttendanceQueryParams,
  CreateAttendancePayload,
  UpdateAttendancePayload,
  BulkAttendancePayload,
} from "@/types/attendance";

interface UseAttendanceOptions {
  autoFetch?: boolean;
  initialParams?: AttendanceQueryParams;
}

interface UseAttendanceReturn {
  attendances: AttendanceWithRelations[];
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  fetchAttendance: (params?: AttendanceQueryParams) => Promise<void>;
  markAttendance: (data: CreateAttendancePayload) => Promise<AttendanceWithRelations | null>;
  updateAttendance: (id: string, data: UpdateAttendancePayload) => Promise<AttendanceWithRelations | null>;
  bulkMarkAttendance: (data: BulkAttendancePayload) => Promise<boolean>;
  deleteAttendance: (id: string) => Promise<boolean>;
}

export function useAttendance(options: UseAttendanceOptions = {}): UseAttendanceReturn {
  const { autoFetch = false, initialParams = {} } = options;

  const [attendances, setAttendances] = useState<AttendanceWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (params?: AttendanceQueryParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = { ...initialParams, ...params };
      // Filter out undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(queryParams).filter(([_, v]) => v !== undefined)
      );
      
      const response = await api.get<{ data: AttendanceWithRelations[] }>("/api/attendance", cleanParams);
      setAttendances(response.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch attendance";
      setError(message);
      console.error("Error fetching attendance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [initialParams]);

  const markAttendance = useCallback(async (data: CreateAttendancePayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await api.post<AttendanceWithRelations>("/api/attendance", data);
      setAttendances(prev => {
        // If exists, update, else add
        const index = prev.findIndex(a => a.id === result.id);
        if (index >= 0) {
          const newArr = [...prev];
          newArr[index] = result;
          return newArr;
        }
        return [...prev, result];
      });
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to mark attendance";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const updateAttendance = useCallback(async (id: string, data: UpdateAttendancePayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const result = await api.patch<AttendanceWithRelations>(`/api/attendance/${id}`, data);
      setAttendances(prev => prev.map(a => a.id === id ? result : a));
      return result;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update attendance";
      setError(message);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const bulkMarkAttendance = useCallback(async (data: BulkAttendancePayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      await api.post("/api/attendance/bulk", data);
      // Refresh after bulk update
      await fetchAttendance({ eventId: data.eventId });
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to bulk mark attendance";
      setError(message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [fetchAttendance]);

  const deleteAttendance = useCallback(async (id: string) => {
    setIsUpdating(true);
    setError(null);
    try {
      await api.delete(`/api/attendance/${id}`);
      setAttendances(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete attendance";
      setError(message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchAttendance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    attendances,
    isLoading,
    isUpdating,
    error,
    fetchAttendance,
    markAttendance,
    updateAttendance,
    bulkMarkAttendance,
    deleteAttendance
  };
}
