import { db } from "@/lib/db";

export interface CertCheckFailure {
  certificationId: string;
  certificationName: string;
  reason: "not_granted" | "expired" | "failed";
}

export interface CertCheckResult {
  valid: boolean;
  missing: CertCheckFailure[];
}

/**
 * Checks whether a member has all required certifications for a given scope.
 * Returns { valid: true } if all certs are met, otherwise lists missing ones.
 */
export async function checkMemberCertifications(
  organizationId: string,
  memberId: string,
  scope: "programs" | "events" | "competitions"
): Promise<CertCheckResult> {
  const scopeFilter =
    scope === "programs"
      ? { requiredForPrograms: true }
      : scope === "events"
        ? { requiredForEvents: true }
        : { requiredForCompetitions: true };

  const requiredCerts = await db.certification.findMany({
    where: {
      organizationId,
      isActive: true,
      ...scopeFilter,
    },
  });

  if (requiredCerts.length === 0) {
    return { valid: true, missing: [] };
  }

  const memberCerts = await db.memberCertification.findMany({
    where: {
      memberId,
      certificationId: { in: requiredCerts.map((c) => c.id) },
    },
  });

  const memberCertMap = new Map(memberCerts.map((mc) => [mc.certificationId, mc]));

  const now = new Date();
  const missing: CertCheckFailure[] = [];

  for (const cert of requiredCerts) {
    const mc = memberCertMap.get(cert.id);
    if (!mc) {
      missing.push({
        certificationId: cert.id,
        certificationName: cert.name,
        reason: "not_granted",
      });
    } else if (!mc.passed) {
      missing.push({
        certificationId: cert.id,
        certificationName: cert.name,
        reason: "failed",
      });
    } else if (mc.expiresAt && mc.expiresAt < now) {
      missing.push({
        certificationId: cert.id,
        certificationName: cert.name,
        reason: "expired",
      });
    }
  }

  return { valid: missing.length === 0, missing };
}

/**
 * Checks all organization members against required certifications for a scope.
 * Returns a map of memberId -> CertCheckResult for efficient bulk lookup.
 */
export async function checkAllMembersCertifications(
  organizationId: string,
  scope: "programs" | "events" | "competitions"
): Promise<{ requiredCertNames: string[]; memberStatus: Record<string, CertCheckResult> }> {
  const scopeFilter =
    scope === "programs"
      ? { requiredForPrograms: true }
      : scope === "events"
        ? { requiredForEvents: true }
        : { requiredForCompetitions: true };

  const requiredCerts = await db.certification.findMany({
    where: {
      organizationId,
      isActive: true,
      ...scopeFilter,
    },
  });

  const requiredCertNames = requiredCerts.map((c) => c.name);

  if (requiredCerts.length === 0) {
    return { requiredCertNames: [], memberStatus: {} };
  }

  const members = await db.organizationMember.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const allMemberCerts = await db.memberCertification.findMany({
    where: {
      memberId: { in: members.map((m) => m.id) },
      certificationId: { in: requiredCerts.map((c) => c.id) },
    },
  });

  const memberCertMap = new Map<string, typeof allMemberCerts>();
  for (const mc of allMemberCerts) {
    const existing = memberCertMap.get(mc.memberId) || [];
    existing.push(mc);
    memberCertMap.set(mc.memberId, existing);
  }

  const now = new Date();
  const memberStatus: Record<string, CertCheckResult> = {};

  for (const member of members) {
    const certs = memberCertMap.get(member.id) || [];
    const certById = new Map(certs.map((mc) => [mc.certificationId, mc]));
    const missing: CertCheckFailure[] = [];

    for (const cert of requiredCerts) {
      const mc = certById.get(cert.id);
      if (!mc) {
        missing.push({
          certificationId: cert.id,
          certificationName: cert.name,
          reason: "not_granted",
        });
      } else if (!mc.passed) {
        missing.push({ certificationId: cert.id, certificationName: cert.name, reason: "failed" });
      } else if (mc.expiresAt && mc.expiresAt < now) {
        missing.push({ certificationId: cert.id, certificationName: cert.name, reason: "expired" });
      }
    }

    memberStatus[member.id] = { valid: missing.length === 0, missing };
  }

  return { requiredCertNames, memberStatus };
}
