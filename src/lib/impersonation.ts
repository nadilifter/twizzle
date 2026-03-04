import { Session } from "next-auth";
import { db } from "./db";

export interface EffectiveUser {
  userId: string;
  organizationId: string;
  organizationName: string;
  isImpersonating: boolean;
}

/**
 * Get the effective user ID and organization for data queries.
 * If a superadmin is viewing as another user, returns that user's info.
 * Otherwise, returns the actual user's info.
 *
 * Requires a DB lookup when impersonating to resolve the target user's organization.
 */
export async function getEffectiveUser(session: Session | null): Promise<EffectiveUser | null> {
  if (!session?.user) {
    return null;
  }

  const user = session.user;

  if (user.isSuperAdmin && user.viewingAsUserId) {
    const targetUser = await db.user.findUnique({
      where: { id: user.viewingAsUserId },
      include: { organization: true },
    });

    if (!targetUser) {
      return null;
    }

    return {
      userId: targetUser.id,
      organizationId: targetUser.organizationId || "",
      organizationName: targetUser.organization?.name || "",
      isImpersonating: true,
    };
  }

  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    isImpersonating: false,
  };
}

/**
 * Get the effective coach ID for coach-specific queries.
 * If a superadmin is viewing as another user, returns that user's ID.
 */
export async function getEffectiveCoachId(session: Session | null): Promise<string | null> {
  const effective = await getEffectiveUser(session);
  return effective?.userId || null;
}

/**
 * Get the effective organization ID for org-scoped queries.
 * If a superadmin is viewing as another user, returns that user's org ID.
 */
export async function getEffectiveOrganizationId(session: Session | null): Promise<string | null> {
  const effective = await getEffectiveUser(session);
  return effective?.organizationId || null;
}

/**
 * Check if the current session is in impersonation mode
 */
export function isImpersonating(session: Session | null): boolean {
  if (!session?.user) return false;
  return !!(session.user.isSuperAdmin && session.user.viewingAsUserId);
}
