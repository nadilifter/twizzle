import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for OAuth state signing");
  }
  return secret;
}

export function createSignedState(organizationId: string): string {
  const payload = {
    organizationId,
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_MAX_AGE_MS,
  };

  const data = JSON.stringify(payload);
  const signature = createHmac("sha256", getSecret()).update(data).digest("base64url");

  return Buffer.from(JSON.stringify({ data, signature })).toString("base64url");
}

export function verifySignedState(state: string): { organizationId: string } {
  let parsed: { data: string; signature: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    throw new Error("Invalid state format");
  }

  const expectedSig = createHmac("sha256", getSecret()).update(parsed.data).digest("base64url");

  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(parsed.signature);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    throw new Error("Invalid state signature");
  }

  const payload = JSON.parse(parsed.data) as {
    organizationId: string;
    nonce: string;
    exp: number;
  };

  if (Date.now() > payload.exp) {
    throw new Error("State expired");
  }

  return { organizationId: payload.organizationId };
}
