import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 16;
const LEGACY_SALT = "uplifter-accounting-token-salt";

function getSecret(): string {
  const secret = process.env.ACCOUNTING_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ACCOUNTING_ENCRYPTION_KEY environment variable is required for token encryption");
  }
  return secret;
}

function deriveKey(salt: string | Buffer): Buffer {
  return scryptSync(getSecret(), salt, 32);
}

/**
 * Encrypt with a random per-operation salt.
 * Output format: salt_hex:iv_hex:authTag_hex:ciphertext_hex (4 segments)
 */
export function encrypt(plaintext: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(salt);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${salt.toString("hex")}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt a value, supporting both new (random salt, 4 segments) and
 * legacy (static salt, 3 segments) formats for backwards compatibility.
 */
export function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(":");

  if (parts.length === 4) {
    const [saltHex, ivHex, authTagHex, ciphertext] = parts;
    const key = deriveKey(Buffer.from(saltHex, "hex"));
    return decryptWithKey(key, ivHex, authTagHex, ciphertext);
  }

  if (parts.length === 3) {
    const [ivHex, authTagHex, ciphertext] = parts;
    const key = deriveKey(LEGACY_SALT);
    return decryptWithKey(key, ivHex, authTagHex, ciphertext);
  }

  throw new Error("Invalid encrypted value format");
}

function decryptWithKey(key: Buffer, ivHex: string, authTagHex: string, ciphertext: string): string {
  if (!ivHex || !authTagHex || !ciphertext) {
    throw new Error("Invalid encrypted value format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
