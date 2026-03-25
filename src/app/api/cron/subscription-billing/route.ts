import crypto from "crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  generateMonthlyInvoices,
  processInvoicePayment,
} from "@/lib/subscription-billing"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Subscription Billing Cron
 *
 * Generates invoices for all active paid subscriptions and processes payments.
 *
 * Schedule: 1st of each month at noon UTC ("0 12 1 * *")
 *
 * Trigger methods:
 * - Local: curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/subscription-billing
 * - Vercel: Configured in vercel.json
 * - AWS: EventBridge scheduled rule
 */

const CRON_SECRET = process.env.CRON_SECRET

function verifyCronSecret(authHeader: string | null): boolean {
  if (!CRON_SECRET || !authHeader) return false
  const expected = `Bearer ${CRON_SECRET}`
  if (authHeader.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
}

export async function GET(request: NextRequest) {
  try {
    if (!CRON_SECRET) {
      console.error("CRON_SECRET is not configured")
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    if (!verifyCronSecret(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const dryRun = searchParams.get("dryRun") === "true"

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: "Dry run mode - no invoices generated or payments processed",
        timestamp: new Date().toISOString(),
      })
    }

    const invoiceResult = await generateMonthlyInvoices()

    const pendingInvoices = await db.subscriptionInvoice.findMany({
      where: { status: "PENDING" },
      select: { id: true },
    })

    let paid = 0
    let failed = 0
    const paymentErrors: string[] = []

    for (const invoice of pendingInvoices) {
      try {
        const success = await processInvoicePayment(invoice.id)
        if (success) {
          paid++
        } else {
          failed++
        }
      } catch (err) {
        failed++
        paymentErrors.push(
          `Invoice ${invoice.id}: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        invoicesGenerated: invoiceResult.generated,
        invoicesSkipped: invoiceResult.skipped,
        paymentsPaid: paid,
        paymentsFailed: failed,
      },
      errors:
        invoiceResult.errors.length > 0 || paymentErrors.length > 0
          ? [...invoiceResult.errors, ...paymentErrors]
          : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in subscription-billing cron:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process subscription billing",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
