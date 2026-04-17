import crypto from "crypto";
import { db } from "@/lib/db";
import { sendTemplatedEmail } from "@/lib/email";
import { getSubdomainUrl } from "@/lib/env-domains";

/**
 * Resolves or provisions a user account during guest checkout, and ensures
 * the user has an active OrganizationMember record for the purchasing org.
 *
 * Scenario 2 (existing user, not logged in):
 *   - ACTIVE:   links invoice to their account; org membership left unchanged
 *   - INACTIVE: links invoice — reactivation and email handled by finalize after payment;
 *               re-activates org membership (voluntary purchase = re-engagement)
 *   - INVITED:  links invoice and activates their org membership
 *
 * Scenario 3 (new user): creates a User record (no password) and an ACTIVE
 * OrganizationMember. The setup token and email are handled by the finalize
 * route after payment succeeds.
 */
export async function resolveOrProvisionCheckoutUser({
  email,
  firstName,
  lastName,
  organizationId,
}: {
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
}): Promise<{ userId: string; isNewUser: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (user) {
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      create: { organizationId, userId: user.id, role: "PARENT", status: "ACTIVE" },
      update: { status: "ACTIVE" },
    });
    return { userId: user.id, isNewUser: false };
  }

  // New user — create account. Setup token and email are handled by finalize
  // after payment is confirmed, so no orphan tokens from abandoned checkouts.
  let newUserId: string;
  try {
    const newUser = await db.user.create({
      data: {
        email: normalizedEmail,
        name: `${firstName.trim()} ${lastName.trim()}`,
        role: "PARENT",
        status: "ACTIVE",
      },
    });
    newUserId = newUser.id;
  } catch (err: any) {
    // Race condition: another concurrent checkout created this user between
    // our findUnique and create calls. Fall back to the existing record.
    if (err.code === "P2002") {
      const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (existing) {
        newUserId = existing.id;
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId: newUserId } },
    create: { organizationId, userId: newUserId, role: "PARENT", status: "ACTIVE" },
    update: { status: "ACTIVE" },
  });

  return { userId: newUserId, isNewUser: true };
}

/**
 * Creates a setup token and sends the "Create Your Account" email after payment succeeds.
 * Safe to call for any userId — exits silently if not applicable.
 *
 * Also reactivates INACTIVE users post-payment.
 * Only sends the email if:
 *   - The user has no password (account not yet set up)
 *   - No setup email was sent in the last 24 hours (dedup guard)
 */
export async function sendCheckoutSetupEmailIfNeeded(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, passwordHash: true, status: true },
  });

  if (!user) return;

  // Reactivate INACTIVE users post-payment. If admin-deactivated accounts
  // ever need to stay blocked, add a `deactivationReason` check here
  if (user.status === "INACTIVE") {
    await db.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
  }

  // user has password, return out
  if (user.passwordHash !== null) return;

  // Create a token now that payment is confirmed. Returns null if a token
  // was already created in the last 24 hours — meaning an email was already sent.
  const token = await createSetupToken(user.email);
  if (!token) return;

  const loginUrl = getSubdomainUrl("login");
  const setupUrl = `${loginUrl}/reset-password?token=${token}`;
  const firstName = user.name?.split(" ")[0] ?? "there";

  await sendTemplatedEmail("checkout-account-setup", [user.email], {
    name: firstName,
    setupUrl,
    expiresIn: "48 hours",
  });
}

/**
 * Creates a fresh PasswordResetToken for the given email.
 * Returns the token string, or null if skipped (one already exists
 * from the last 24 hours — dedup guard against multiple purchases).
 */
async function createSetupToken(email: string): Promise<string | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentToken = await db.passwordResetToken.findFirst({
    where: {
      email,
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gte: oneDayAgo },
    },
  });

  if (recentToken) return null;

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.$transaction([
    db.passwordResetToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: { email, token, expiresAt },
    }),
  ]);

  return token;
}
