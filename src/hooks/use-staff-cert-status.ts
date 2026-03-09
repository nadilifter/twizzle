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

export function useStaffCertStatus(scope: "programs" | "events" | "competitions") {
  const [data, setData] = useState<StaffCertStatus>({ requiredCertNames: [], memberStatus: {} });
  const [isLoading, setIsLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organization/staff/certification-status?scope=${scope}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Non-critical — staff can still be selected
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

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
