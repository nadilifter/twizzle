import crypto from "crypto";
import { db } from "./db";
import { VerificationCodeType } from "@prisma/client";

function getAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set — cannot sign or verify tokens");
  }
  return secret;
}

// ── Signed proof tokens ─────────────────────────────────────────────────
// These short-lived HMAC-signed tokens prove that a verification was
// completed (via magic link click). They are passed back to the login page
// and accepted by the auth providers as an alternative to a DB code.

export function createVerifiedToken(email: string, type: string): string {
  const secret = getAuthSecret();
  const exp = Date.now() + 5 * 60 * 1000; // 5 minutes
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${email}:${type}:${exp}`)
    .digest("base64url");

  const payload = { email, type, exp, signature };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function verifyVerifiedToken(token: string, expectedType: string): { email: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(token, "base64url").toString("utf-8"));
    if (!payload.email || !payload.type || !payload.exp || !payload.signature) {
      return null;
    }
    if (payload.type !== expectedType) return null;
    if (Date.now() > payload.exp) return null;

    const secret = getAuthSecret();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${payload.email}:${payload.type}:${payload.exp}`)
      .digest("base64url");

    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(payload.signature);
    if (
      expectedBuf.length !== actualBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, actualBuf)
    ) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}

export const MFA_INACTIVITY_DAYS = 30;
export const CODE_EXPIRY_MINUTES = 10;

// Uppercase letters + digits, excluding ambiguous characters: 0, O, 1, I, L
const SAFE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Determine whether a password-based login requires MFA verification.
 * MFA is required when the user has previously logged in but has been
 * inactive for longer than the configured threshold.
 */
export function shouldRequireMfa(lastActiveAt: Date | null): boolean {
  if (!lastActiveAt) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MFA_INACTIVITY_DAYS);
  return lastActiveAt < cutoff;
}

/**
 * Generate a random alphanumeric code from the safe alphabet.
 */
export function generateAlphanumericCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += SAFE_ALPHABET[crypto.randomInt(SAFE_ALPHABET.length)];
  }
  return code;
}

/**
 * Create a new verification code for the given email and type.
 * Invalidates any previous unused codes for the same email+type combination.
 * Returns both the short alphanumeric code and the UUID token for the magic link.
 */
export async function createVerificationCode(
  email: string,
  type: VerificationCodeType
): Promise<{ code: string; token: string }> {
  // Invalidate previous unused codes for this email+type
  await db.emailVerificationCode.updateMany({
    where: { email, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateAlphanumericCode();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await db.emailVerificationCode.create({
    data: { email, code, token, type, expiresAt },
  });

  return { code, token };
}

/**
 * Validate a verification code or magic link token.
 * Accepts either the 6-char short code or the UUID token.
 * Uses an atomic updateMany with usedAt IS NULL to prevent
 * concurrent requests from double-consuming the same code.
 */
export async function validateVerificationCode(
  email: string,
  codeOrToken: string,
  type: VerificationCodeType
): Promise<boolean> {
  const isToken = codeOrToken.length > 10;

  const result = await db.emailVerificationCode.updateMany({
    where: {
      email,
      type,
      usedAt: null,
      expiresAt: { gt: new Date() },
      ...(isToken ? { token: codeOrToken } : { code: codeOrToken.toUpperCase() }),
    },
    data: { usedAt: new Date() },
  });

  return result.count > 0;
}

/**
 * Validate a magic link token directly (without email).
 * Uses an atomic update with usedAt IS NULL to prevent double-use.
 * Returns the record if valid, or null.
 */
export async function validateVerificationToken(
  token: string
): Promise<{ email: string; type: VerificationCodeType } | null> {
  const record = await db.emailVerificationCode.findUnique({
    where: { token },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  const result = await db.emailVerificationCode.updateMany({
    where: {
      id: record.id,
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  if (result.count === 0) return null;

  return { email: record.email, type: record.type };
}
