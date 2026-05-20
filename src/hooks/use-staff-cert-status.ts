"use client";

import { useState, useEffect, useCallback } from "react";

export interface CertCheckFailure {
  certificationId: string;
  certificationName: string;
  reason: "not_granted" | "expired" | "failed";
}

export interface CertCheckResult {
  valid: boolean;
  missing: CertCheckFailure[];
}

interface StaffCertStatus {
  requiredCertNames: string[];
  memberStatus: Record<string, CertCheckResult>;
}

// Module-level stale-while-revalidate cache keyed by scope.
const LIST_CACHE_TTL_MS = 60_000;
type ListCacheEntry = { data: StaffCertStatus; fetchedAt: number };
const listCache = new Map<string, ListCacheEntry>();

const EMPTY: StaffCertStatus = { requiredCertNames: [], memberStatus: {} };

export function useStaffCertStatus(scope: "programs" | "events" | "competitions") {
  const initialCached = listCache.get(scope);

  const [data, setData] = useState<StaffCertStatus>(() => initialCached?.data ?? EMPTY);
  const [isLoading, setIsLoading] = useState(() => !initialCached);

  const fetch_ = useCallback(async () => {
    const cached = listCache.get(scope);
    if (!cached) setIsLoading(true);
    try {
      const res = await fetch(`/api/organization/staff/certification-status?scope=${scope}`);
      if (res.ok) {
        const json: StaffCertStatus = await res.json();
        setData(json);
        listCache.set(scope, { data: json, fetchedAt: Date.now() });
      }
    } catch {
      // Non-critical — staff can still be selected
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    const cached = listCache.get(scope);
    const isFresh = cached && Date.now() - cached.fetchedAt < LIST_CACHE_TTL_MS;
    if (isFresh) {
      setData(cached.data);
      return;
    }
    fetch_();
  }, [scope, fetch_]);

  const getMemberStatus = useCallback(
    (memberId: string): CertCheckResult => {
      return data.memberStatus[memberId] ?? { valid: true, missing: [] };
    },
    [data.memberStatus]
  );

  return {
    requiredCertNames: data.requiredCertNames,
    hasRequirements: data.requiredCertNames.length > 0,
    memberStatus: data.memberStatus,
    getMemberStatus,
    isLoading,
    refresh: fetch_,
  };
}
