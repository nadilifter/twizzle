import { Session } from "next-auth";

/**
 * Impersonation utilities for superadmin "view as coach" feature
 * 
 * When a superadmin is viewing as a coach, we use the impersonated coach's
 * ID and organization instead of the superadmin's own ID.
 */

export interface EffectiveUser {
  userId: string;
  organizationId: string;
  organizationName: string;
  isImpersonating: boolean;
}

/**
 * Get the effective user ID and organization for data queries.
 * If a superadmin is viewing as a coach, returns the impersonated coach's info.
 * Otherwise, returns the actual user's info.
 */
export function getEffectiveUser(session: Session | null): EffectiveUser | null {
  if (!session?.user) {
    return null;
  }

  const user = session.user;

  // Check if superadmin is impersonating a coach
  if (user.isSuperAdmin && user.viewingAsCoachId && user.viewingAsOrganizationId) {
    return {
      userId: user.viewingAsCoachId,
      organizationId: user.viewingAsOrganizationId,
      organizationName: user.viewingAsOrganizationName || "",
      isImpersonating: true,
    };
  }

  // Normal user - return their own info
  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    isImpersonating: false,
  };
}

/**
 * Get the effective coach ID for coach-specific queries.
 * If a superadmin is viewing as a coach, returns the impersonated coach's ID.
 */
export function getEffectiveCoachId(session: Session | null): string | null {
  const effective = getEffectiveUser(session);
  return effective?.userId || null;
}

/**
 * Get the effective organization ID for org-scoped queries.
 * If a superadmin is viewing as a coach, returns the impersonated org's ID.
 */
export function getEffectiveOrganizationId(session: Session | null): string | null {
  const effective = getEffectiveUser(session);
  return effective?.organizationId || null;
}

/**
 * Check if the current session is in impersonation mode
 */
export function isImpersonating(session: Session | null): boolean {
  if (!session?.user) return false;
  return !!(
    session.user.isSuperAdmin && 
    session.user.viewingAsCoachId && 
    session.user.viewingAsOrganizationId
  );
}
