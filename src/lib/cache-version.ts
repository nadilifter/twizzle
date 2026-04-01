import { db } from "@/lib/db";

/**
 * Retrieve the current cache version for an entity type within an organization.
 * This is a single-row PK lookup (sub-millisecond) and must NOT be cached itself.
 */
export async function getCacheVersion(organizationId: string, entityType: string): Promise<number> {
  const row = await db.cacheVersion.findUnique({
    where: { organizationId_entityType: { organizationId, entityType } },
    select: { version: true },
  });
  return row?.version ?? 0;
}

/**
 * Increment the cache version for an entity type within an organization.
 * Call this from API routes after successful mutations so that marketing
 * site pages pick up fresh data on the next request.
 */
export async function bumpCacheVersion(organizationId: string, entityType: string): Promise<void> {
  await db.cacheVersion.upsert({
    where: { organizationId_entityType: { organizationId, entityType } },
    update: { version: { increment: 1 } },
    create: { organizationId, entityType, version: 1 },
  });
}
