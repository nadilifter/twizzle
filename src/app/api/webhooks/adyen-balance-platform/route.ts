import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * Temporary balance platform webhook stub.
 * Accepts events from Adyen with HMAC verification.
 * Will be replaced with full event processing in Phase 2.
 */

function getBpHmacKeys(): string[] {
  return [
    process.env.ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY,
    process.env.ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY,
  ].filter(Boolean) as string[]
}

function verifyHmac(rawBody: string, signature: string): boolean {
  const hmacKeys = getBpHmacKeys()
  for (const hmacKey of hmacKeys) {
    try {
      const expected = crypto
        .createHmac("sha256", Buffer.from(hmacKey, "hex"))
        .update(rawBody, "utf-8")
        .digest("base64")

      if (
        signature.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        return true
      }
    } catch {
      continue
    }
  }
  return false
}

export async function POST(request: NextRequest) {
  const body = await request.text()

  // Adyen sends HMAC in the "Hmacsignature" header (no hyphen)
  const hmacSignature =
    request.headers.get("hmacsignature") ||
    request.headers.get("hmac-signature") ||
    ""
  const hmacKeys = getBpHmacKeys()

  if (hmacKeys.length > 0 && hmacSignature) {
    if (!verifyHmac(body, hmacSignature)) {
      console.warn("[BP-WEBHOOK] HMAC verification failed")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
  }

  try {
    const event = JSON.parse(body)
    console.log(`[BP-WEBHOOK] ${event.type}`)
  } catch {
    console.warn("[BP-WEBHOOK] Non-JSON payload received")
  }

  return NextResponse.json({ notificationResponse: "[accepted]" })
}
