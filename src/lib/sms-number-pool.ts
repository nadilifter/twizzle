import { db } from "@/lib/db";
import {
  normalizePhoneNumber,
  fetchVerifiedTollFreeNumbers,
  isTwilioConfigured,
} from "@/lib/twilio";

/**
 * SMS Number Pool Manager
 *
 * Manages a pool of Twilio phone numbers to enable deterministic inbound
 * routing across multiple organizations. Each (guardian phone, org) pair
 * is assigned a sticky pool number so replies can be unambiguously routed.
 *
 * Only toll-free numbers with TWILIO_APPROVED verification status are
 * included in the active pool. The verified set is cached and refreshed
 * every hour so newly-verified numbers are picked up automatically.
 */

const POOL_REFRESH_MS = 60 * 60 * 1000; // 1 hour

let _rawPool: string[] | null = null;
let _verifiedPool: string[] | null = null;
let _verifiedPoolAt = 0;

/**
 * Parse the SMS_PHONE_POOL env var into an array of E.164 numbers.
 * Falls back to [TWILIO_PHONE_NUMBER] if unset.
 */
export function getPhonePool(): string[] {
  if (_rawPool) return _rawPool;

  const poolEnv = process.env.SMS_PHONE_POOL;
  if (poolEnv) {
    _rawPool = poolEnv
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (_rawPool.length > 0) return _rawPool;
  }

  const fallback = process.env.TWILIO_PHONE_NUMBER;
  _rawPool = fallback ? [fallback] : [];
  return _rawPool;
}

/**
 * Return the subset of pool numbers whose toll-free verification is approved.
 * Falls back to the full pool if Twilio is unreachable or unconfigured.
 */
async function getVerifiedPool(): Promise<string[]> {
  const raw = getPhonePool();
  if (raw.length === 0) return raw;

  const now = Date.now();
  if (_verifiedPool && now - _verifiedPoolAt < POOL_REFRESH_MS) {
    return _verifiedPool;
  }

  if (!isTwilioConfigured()) {
    _verifiedPool = raw;
    _verifiedPoolAt = now;
    return raw;
  }

  try {
    const approved = await fetchVerifiedTollFreeNumbers();
    const filtered = raw.filter((n) => approved.has(n));

    if (filtered.length === 0) {
      console.warn(
        "[SMS POOL] No verified toll-free numbers found in pool. Using full pool as fallback."
      );
      _verifiedPool = raw;
    } else {
      if (filtered.length < raw.length) {
        const pending = raw.filter((n) => !approved.has(n));
        console.info(
          `[SMS POOL] Active pool: ${filtered.join(", ")} | Pending verification: ${pending.join(", ")}`
        );
      }
      _verifiedPool = filtered;
    }

    _verifiedPoolAt = now;
    return _verifiedPool;
  } catch (err) {
    console.error("[SMS POOL] Failed to check toll-free verification status:", err);
    _verifiedPool = _verifiedPool ?? raw;
    _verifiedPoolAt = now;
    return _verifiedPool;
  }
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
  const pool = await getVerifiedPool();
  if (pool.length === 0) {
    return process.env.TWILIO_PHONE_NUMBER || "";
  }

  const normalized = normalizePhoneNumber(phone);

  const existing = await db.smsNumberAssignment.findUnique({
    where: { phone_organizationId: { phone: normalized, organizationId } },
  });

  if (existing) {
    if (pool.includes(existing.twilioNumber)) {
      return existing.twilioNumber;
    }
    // Assignment points to a number no longer in the verified pool.
    // Re-assign to the first available verified number.
    const takenByOthers = await db.smsNumberAssignment.findMany({
      where: { phone: normalized, organizationId: { not: organizationId } },
      select: { twilioNumber: true },
    });
    const taken = new Set(takenByOthers.map((a) => a.twilioNumber));
    const replacement = pool.find((n) => !taken.has(n)) ?? pool[0];

    await db.smsNumberAssignment.update({
      where: { id: existing.id },
      data: { twilioNumber: replacement, updatedAt: new Date() },
    });
    return replacement;
  }

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
    await db.smsNumberAssignment.upsert({
      where: { phone_twilioNumber: { phone: normalized, twilioNumber: chosen } },
      update: { organizationId, updatedAt: new Date() },
      create: { phone: normalized, twilioNumber: chosen, organizationId },
    });
    return chosen;
  }

  try {
    await db.smsNumberAssignment.create({
      data: { phone: normalized, twilioNumber: chosen, organizationId },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const raced = await db.smsNumberAssignment.findUnique({
        where: { phone_organizationId: { phone: normalized, organizationId } },
      });
      if (raced) return raced.twilioNumber;
    }
    throw err;
  }

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
