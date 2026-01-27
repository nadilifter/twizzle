"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  MembershipGroup,
  MembershipInstance,
  CreateMembershipInstancePayload,
} from "@/types/memberships";

interface UseMembershipGroupReturn {
  group: MembershipGroup | null;
  isLoading: boolean;
  error: string | null;
  fetchGroup: (id: string) => Promise<void>;
  createInstance: (groupId: string, data: CreateMembershipInstancePayload) => Promise<MembershipInstance | null>;
}

export function useMembershipGroup(): UseMembershipGroupReturn {
  const [group, setGroup] = useState<MembershipGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroup = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<MembershipGroup>(`/api/memberships/${id}`);
      setGroup(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch membership group";
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createInstance = useCallback(async (groupId: string, data: CreateMembershipInstancePayload) => {
    setError(null);
    try {
      const newInstance = await api.post<MembershipInstance>(`/api/memberships/${groupId}/instances`, data);
      // Optimistically update group instances list
      if (group && group.id === groupId) {
         setGroup({
             ...group,
             instances: [newInstance, ...(group.instances || [])]
         });
      }
      return newInstance;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create instance";
      setError(message);
      console.error(err);
      return null;
    }
  }, [group]);

  return {
    group,
    isLoading,
    error,
    fetchGroup,
    createInstance,
  };
}
