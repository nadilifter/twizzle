import { db } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/twilio";

/**
 * SMS Number Pool Manager
 *
 * Manages a pool of Twilio phone numbers to enable deterministic inbound
 * routing across multiple organizations. Each (guardian phone, org) pair
 * is assigned a sticky pool number so replies can be unambiguously routed.
 */

let _cachedPool: string[] | null = null;

/**
 * Parse the SMS_PHONE_POOL env var into an array of E.164 numbers.
 * Falls back to [TWILIO_PHONE_NUMBER] if unset.
 */
export function getPhonePool(): string[] {
  if (_cachedPool) return _cachedPool;

  const poolEnv = process.env.SMS_PHONE_POOL;
  if (poolEnv) {
    _cachedPool = poolEnv
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (_cachedPool.length > 0) return _cachedPool;
  }

  const fallback = process.env.TWILIO_PHONE_NUMBER;
  _cachedPool = fallback ? [fallback] : [];
  return _cachedPool;
}

/**
 * Build normalized phone variants for flexible DB matching.
 * Phones may be stored with or without country code / +prefix.
 */
function phoneVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  const digitsOnly = normalized.replace(/\D/g, "");
  const withoutCountryCode =
    digitsOnly.startsWith("1") && digitsOnly.length === 11
      ? digitsOnly.substring(1)
      : digitsOnly;
  return [normalized, digitsOnly, withoutCountryCode];
}

/**
 * Get (or create) the pool number assigned to a specific guardian phone + org.
 *
 * Algorithm:
 * 1. Return existing assignment if one exists
 * 2. Find which pool numbers are already taken for this phone (other orgs)
 * 3. Pick the first available number
 * 4. If pool is exhausted, log a warning and reuse the first pool number
 * 5. Create the assignment and return the number
 */
export async function getPoolNumberForSend(
  phone: string,
  organizationId: string
): Promise<string> {
  const pool = getPhonePool();
  if (pool.length === 0) {
    return process.env.TWILIO_PHONE_NUMBER || "";
  }

  const normalized = normalizePhoneNumber(phone);

  const existing = await db.smsNumberAssignment.findUnique({
    where: { phone_organizationId: { phone: normalized, organizationId } },
  });
  if (existing) return existing.twilioNumber;

  const takenAssignments = await db.smsNumberAssignment.findMany({
    where: { phone: normalized },
    select: { twilioNumber: true },
  });
  const takenNumbers = new Set(takenAssignments.map((a) => a.twilioNumber));

  let chosen = pool.find((n) => !takenNumbers.has(n));

  if (!chosen) {
    console.warn(
      `\x1b[33m[SMS POOL]\x1b[0m All ${pool.length} numbers exhausted for phone ${normalized}. ` +
        `Reusing first pool number. Consider adding more numbers.`
    );
    chosen = pool[0];
    // Upsert so we don't violate the unique constraint
    await db.smsNumberAssignment.upsert({
      where: { phone_twilioNumber: { phone: normalized, twilioNumber: chosen } },
      update: { organizationId, updatedAt: new Date() },
      create: { phone: normalized, twilioNumber: chosen, organizationId },
    });
    return chosen;
  }

  await db.smsNumberAssignment.create({
    data: { phone: normalized, twilioNumber: chosen, organizationId },
  });

  return chosen;
}

/**
 * Resolve the target organization from an inbound SMS using the number pool.
 *
 * Looks up (fromPhone, toNumber) -> organizationId via SmsNumberAssignment,
 * then finds the userId from OrganizationMember.
 *
 * Returns null if no assignment exists (caller should fall back).
 */
export async function resolveOrgFromInbound(
  fromPhone: string,
  toNumber: string
): Promise<{ organizationId: string; userId: string } | null> {
  const variants = phoneVariants(fromPhone);

  const assignment = await db.smsNumberAssignment.findFirst({
    where: {
      phone: { in: variants },
      twilioNumber: toNumber,
    },
  });

  if (!assignment) return null;

  const member = await db.organizationMember.findFirst({
    where: {
      organizationId: assignment.organizationId,
      user: { phone: { in: variants } },
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  if (!member) {
    // Assignment exists but user is no longer an active member.
    // Still return the org so the message isn't lost; use the phone as a fallback.
    const userByPhone = await db.user.findFirst({
      where: { phone: { in: variants } },
      select: { id: true },
    });
    if (userByPhone) {
      return { organizationId: assignment.organizationId, userId: userByPhone.id };
    }
    return null;
  }

  return { organizationId: assignment.organizationId, userId: member.userId };
}
