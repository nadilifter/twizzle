import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  generateUpcomingInstances,
  processMembershipInstanceRenewals,
  processAthleteRenewals,
  expireInstances,
} from "@/lib/services/membership-renewal"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false
  const expected = `Bearer ${CRON_SECRET}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

/**
 * Membership Renewal Cron
 *
 * Daily maintenance for membership lifecycle:
 * 1. Generate upcoming DRAFT instances for recurring groups (admin review)
 * 2. Process membership instance auto-renewals via autoRenewDate
 * 3. Renew athlete memberships into the next active instance
 * 4. Expire membership instances past their end date
 *
 * Schedule: Daily at 6:00 AM UTC ("0 6 * * *")
 */
export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      logger.error("CRON_SECRET is not configured")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [generated, instanceRenewals, athleteRenewals, expired] = await Promise.all([
      generateUpcomingInstances(),
      processMembershipInstanceRenewals(),
      processAthleteRenewals(),
      expireInstances(),
    ])

    const summary = {
      generatedInstances: generated.length,
      instanceRenewals: instanceRenewals.length,
      athleteRenewals: athleteRenewals.length,
      expiredInstances: expired.expiredCount,
    }

    logger.info("Membership renewal cron completed", summary)
    return NextResponse.json({ success: true, summary, timestamp: new Date().toISOString() })
  } catch (error) {
    logger.error("Membership renewal cron failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { success: false, error: "Failed to process membership renewals", timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
