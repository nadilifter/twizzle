"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  MembershipGroup,
  MembershipInstance,
  MembershipInstanceStatus,
  CreateMembershipInstancePayload,
  UpdateMembershipGroupPayload,
  MembershipGroupLevelRequirement,
  MembershipGroupWaiverRequirement,
} from "@/types/memberships";

interface RestrictionsResponse {
  levelRequirements: MembershipGroupLevelRequirement[];
  waiverRequirements: MembershipGroupWaiverRequirement[];
  restrictions: {
    hasGenderRestriction: boolean;
    hasAgeRestriction: boolean;
    hasLevelRestriction: boolean;
    hasCapacityRestriction: boolean;
    hasWaiverRestriction: boolean;
    hasMedicalRequirement: boolean;
    allowedGenders: string[];
    minAge: number | null;
    maxAge: number | null;
    capacity: number | null;
  };
}

interface UseMembershipGroupReturn {
  group: MembershipGroup | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  fetchGroup: (id: string) => Promise<void>;
  updateGroup: (id: string, data: UpdateMembershipGroupPayload) => Promise<MembershipGroup | null>;
  createInstance: (groupId: string, data: CreateMembershipInstancePayload) => Promise<MembershipInstance | null>;
  updateInstance: (groupId: string, instanceId: string, data: Partial<CreateMembershipInstancePayload> & { status?: MembershipInstanceStatus }) => Promise<MembershipInstance | null>;
  deleteInstance: (groupId: string, instanceId: string) => Promise<boolean>;
  publishInstance: (groupId: string, instanceId: string) => Promise<MembershipInstance | null>;
  fetchRestrictions: (groupId: string) => Promise<RestrictionsResponse | null>;
  addLevelRequirement: (groupId: string, levelId: string) => Promise<MembershipGroupLevelRequirement | null>;
  addWaiverRequirement: (groupId: string, waiverId: string) => Promise<MembershipGroupWaiverRequirement | null>;
  removeRequirement: (groupId: string, type: "level" | "waiver", requirementId: string) => Promise<boolean>;
  clearError: () => void;
}

export function useMembershipGroup(): UseMembershipGroupReturn {
  const [group, setGroup] = useState<MembershipGroup | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
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

  const updateGroup = useCallback(async (id: string, data: UpdateMembershipGroupPayload) => {
    setIsUpdating(true);
    setError(null);
    try {
      const updated = await api.patch<MembershipGroup>(`/api/memberships/${id}`, data);
      setGroup(updated);
      return updated;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update membership group";
      setError(message);
      console.error(err);
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const createInstance = useCallback(async (groupId: string, data: CreateMembershipInstancePayload) => {
    setError(null);
    try {
      const newInstance = await api.post<MembershipInstance>(`/api/memberships/${groupId}/instances`, data);
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

  const updateInstance = useCallback(async (
    groupId: string,
    instanceId: string,
    data: Partial<CreateMembershipInstancePayload> & { status?: MembershipInstanceStatus }
  ) => {
    setError(null);
    try {
      const updated = await api.patch<MembershipInstance>(
        `/api/memberships/${groupId}/instances/${instanceId}`,
        data
      );
      if (group && group.id === groupId) {
        setGroup({
          ...group,
          instances: (group.instances || []).map((inst) =>
            inst.id === instanceId ? updated : inst
          ),
        });
      }
      return updated;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to update instance";
      setError(message);
      console.error(err);
      return null;
    }
  }, [group]);

  const deleteInstance = useCallback(async (groupId: string, instanceId: string) => {
    setError(null);
    try {
      await api.delete(`/api/memberships/${groupId}/instances/${instanceId}`);
      if (group && group.id === groupId) {
        setGroup({
          ...group,
          instances: (group.instances || []).filter((inst) => inst.id !== instanceId),
        });
      }
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to delete instance";
      setError(message);
      console.error(err);
      return false;
    }
  }, [group]);

  const publishInstance = useCallback(async (groupId: string, instanceId: string) => {
    return updateInstance(groupId, instanceId, { status: "ACTIVE" });
  }, [updateInstance]);

  const fetchRestrictions = useCallback(async (groupId: string) => {
    setError(null);
    try {
      return await api.get<RestrictionsResponse>(`/api/memberships/${groupId}/restrictions`);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to fetch restrictions";
      setError(message);
      console.error(err);
      return null;
    }
  }, []);

  const addLevelRequirement = useCallback(async (groupId: string, levelId: string) => {
    setError(null);
    try {
      const requirement = await api.post<MembershipGroupLevelRequirement>(
        `/api/memberships/${groupId}/restrictions`,
        { type: "level", levelId }
      );
      if (group && group.id === groupId) {
        setGroup({
          ...group,
          levelRequirements: [...(group.levelRequirements || []), requirement],
        });
      }
      return requirement;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to add level requirement";
      setError(message);
      console.error(err);
      return null;
    }
  }, [group]);

  const addWaiverRequirement = useCallback(async (groupId: string, waiverId: string) => {
    setError(null);
    try {
      const requirement = await api.post<MembershipGroupWaiverRequirement>(
        `/api/memberships/${groupId}/restrictions`,
        { type: "waiver", waiverId }
      );
      if (group && group.id === groupId) {
        setGroup({
          ...group,
          waiverRequirements: [...(group.waiverRequirements || []), requirement],
        });
      }
      return requirement;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to add waiver requirement";
      setError(message);
      console.error(err);
      return null;
    }
  }, [group]);

  const removeRequirement = useCallback(async (
    groupId: string,
    type: "level" | "waiver",
    requirementId: string
  ) => {
    setError(null);
    try {
      await api.delete(`/api/memberships/${groupId}/restrictions?type=${type}&id=${requirementId}`);
      if (group && group.id === groupId) {
        if (type === "level") {
          setGroup({
            ...group,
            levelRequirements: (group.levelRequirements || []).filter((r) => r.id !== requirementId),
          });
        } else {
          setGroup({
            ...group,
            waiverRequirements: (group.waiverRequirements || []).filter((r) => r.id !== requirementId),
          });
        }
      }
      return true;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to remove requirement";
      setError(message);
      console.error(err);
      return false;
    }
  }, [group]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    group,
    isLoading,
    isUpdating,
    error,
    fetchGroup,
    updateGroup,
    createInstance,
    updateInstance,
    deleteInstance,
    publishInstance,
    fetchRestrictions,
    addLevelRequirement,
    addWaiverRequirement,
    removeRequirement,
    clearError,
  };
}
