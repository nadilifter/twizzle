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
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (!targetUser) {
      return null;
    }

    const targetMembership = targetUser.memberships[0];

    return {
      userId: targetUser.id,
      organizationId: targetMembership?.organizationId || "",
      organizationName: targetMembership?.organization?.name || "",
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

/**
 * Get all organization memberships where the user has coaching.portal permission.
 * Returns memberId + organizationId pairs for multi-org coach queries.
 */
export async function getCoachingMemberships(
  session: Session | null
): Promise<Array<{ memberId: string; organizationId: string; organizationName: string }>> {
  const effective = await getEffectiveUser(session);
  if (!effective) return [];

  const { ROLE_PERMISSIONS } = await import("./permissions");

  // Query through User (non-tenant model) to avoid tenant isolation warning,
  // since this intentionally looks up memberships across all organizations.
  const user = await db.user.findUnique({
    where: { id: effective.userId },
    include: {
      memberships: {
        where: {
          status: "ACTIVE",
          organization: { isActive: true },
        },
        include: {
          permissions: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  const memberships = user?.memberships ?? [];

  return memberships
    .filter((m) => {
      const explicit = m.permissions.map((p) => p.permission);
      if (explicit.includes("*") || explicit.includes("coaching.portal")) return true;
      if (explicit.length === 0) {
        const rolePerms = ROLE_PERMISSIONS[m.role] || [];
        return (
          (rolePerms as string[]).includes("*") ||
          (rolePerms as string[]).includes("coaching.portal")
        );
      }
      return false;
    })
    .map((m) => ({
      memberId: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
    }));
}
