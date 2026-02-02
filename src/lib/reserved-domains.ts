import { db } from "@/lib/db";

/**
 * Check if a subdomain matches any reserved patterns in the database.
 * Supports both EXACT and PREFIX matching types.
 * 
 * @param subdomain - The subdomain to check
 * @returns Object with reserved status and optional reason
 */
export async function isSubdomainReserved(subdomain: string): Promise<{ reserved: boolean; reason?: string }> {
  // Get all reserved domains from the database
  const reservedDomains = await db.reservedDomain.findMany();

  for (const reserved of reservedDomains) {
    if (reserved.type === "EXACT" && subdomain === reserved.pattern) {
      return { reserved: true, reason: reserved.reason || "This subdomain is reserved" };
    }
    if (reserved.type === "PREFIX" && subdomain.startsWith(reserved.pattern)) {
      return { reserved: true, reason: reserved.reason || "This subdomain prefix is reserved" };
    }
  }

  return { reserved: false };
}
