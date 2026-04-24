import crypto from "crypto";

const CRON_SECRET = process.env.CRON_SECRET;

export function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false;
  const expected = `Bearer ${CRON_SECRET}`;
  if (authHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export function assertCronSecret(authHeader: string | null): string | null {
  if (!CRON_SECRET) return "Server misconfiguration";
  if (!verifyCronSecret(authHeader)) return "Unauthorized";
  return null;
}
