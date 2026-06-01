/**
 * Development Seed Script (seed-dev.ts)
 * =====================================
 *
 * Comprehensive fixtures for **local development only**. Creates multiple
 * organizations with realistic multi-tenant data so we can exercise features
 * end-to-end without hand-crafting DB state.
 *
 * Run with:
 *   pnpm db:seed:dev      (run dev seed only)
 *   pnpm db:reset         (reset schema + run dev seed)
 *
 * Organizations:
 * 1. Sunrise Skating Club - Youth figure skating club (comprehensive data)
 * 2. Demo Skating Club - Demo/testing organization
 * 3. Uplifter - Platform owner organization
 *
 * Scope boundary — what belongs in this file:
 *   ✓ Realistic fixture data for every model in schema.prisma
 *   ✓ Edge-case shapes (refunds, partial payments, varied enrollment states, etc.)
 *   ✓ Adyen TEST-environment account replay so the financials dashboard has data
 *   ✓ Multi-tenant variety (different lifecycle stages, plan tiers, sports mixes)
 *
 * What does NOT belong here:
 *   ✗ Anything that needs to run in production or new envs — that goes in seed.ts
 *     (the bootstrap seed: minimal data needed for the app to boot and log in).
 *   ✗ Reserved-domain data — that lives in seed-reserved.ts and is unrelated.
 *
 * Maintenance:
 * - Use deterministic IDs (prefixed with org slug) for idempotent seeding
 * - Use upsert pattern so re-running doesn't fail on existing data
 * - When adding a new model to schema.prisma, add seed data in the matching section
 *
 * See also: docs/SEEDING.md for the full seed-script contract and Adyen test setup.
 */

import { PrismaClient, Prisma } from "@prisma/client";

import { Redis } from "@upstash/redis";
import {
  listBalanceAccountTransfers,
  getTransferInstrumentLast4,
  getBalanceAccountSweepDescription,
  isPlatformConfigured,
} from "@/lib/adyen-platform";
import { createSystemRulesForOrganization } from "@/lib/notification-service";
import { seedSkateCanadaSeasons, seedSkatingTaxonomy, SKATE_SEED_COUNTS } from "./skate-seed";

const prisma = new PrismaClient();

// Initialize Redis client for analytics seeding (if configured)
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// ============================================
// CONSTANTS & HELPERS
// ============================================

const ORG1_ID = "seed-org-sunrise";
const ORG_DEMO_ID = "seed-org-demo-gym";
const ORG_UPLIFTER_ID = "seed-org-uplifter";
// Plan IDs will be dynamically assigned from the upsert results

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/** Parse a YYYY-MM-DD string as noon UTC to prevent timezone date shifts */
function noonUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}
// ---------------------------------------------------------------------------
// Adyen sync helpers
// ---------------------------------------------------------------------------

// Inlined from payout-utils to avoid pulling @/lib/db into the seed process.
const ADYEN_SWEEP_REF_RE = /^SWPE\w+$/;
function seedDeterminePayoutType(
  desc: string | null | undefined,
  sweepDesc: string | null | undefined
): "SWEEP" | "MANUAL" {
  const d = (desc ?? "").toUpperCase();
  const s = sweepDesc?.toUpperCase();
  const matchesPrefix = (str: string, prefix: string) =>
    str === prefix ||
    (str.startsWith(prefix + " ") && ADYEN_SWEEP_REF_RE.test(str.slice(prefix.length + 1)));
  if (s) return matchesPrefix(d, s) ? "SWEEP" : "MANUAL";
  return matchesPrefix(d, "EXT BAL SWEEP") ? "SWEEP" : "MANUAL";
}

function mapTransferTypeToTxnType(
  type: string
): "PAYMENT" | "REFUND" | "CHARGEBACK" | "CAPTURE" | "CANCEL" | null {
  const map: Record<string, "PAYMENT" | "REFUND" | "CHARGEBACK" | "CAPTURE" | "CANCEL"> = {
    payment: "PAYMENT",
    capture: "CAPTURE",
    captureReversal: "CANCEL",
    refund: "REFUND",
    refundReversal: "REFUND",
    chargeback: "CHARGEBACK",
    chargebackReversal: "CHARGEBACK",
    chargebackCorrection: "CHARGEBACK",
    secondChargeback: "CHARGEBACK",
    secondChargebackCorrection: "CHARGEBACK",
  };
  return map[type] ?? null;
}

function mapTransferStatusToTxnStatus(
  status: string
): "AUTHORISED" | "CAPTURED" | "SETTLED" | "REFUSED" | "CANCELLED" | "ERROR" | "PENDING" {
  const map: Record<
    string,
    "AUTHORISED" | "CAPTURED" | "SETTLED" | "REFUSED" | "CANCELLED" | "ERROR" | "PENDING"
  > = {
    booked: "SETTLED",
    captured: "CAPTURED",
    capturePending: "CAPTURED",
    authorised: "AUTHORISED",
    received: "AUTHORISED",
    merchantPayin: "AUTHORISED",
    merchantPayinPending: "PENDING",
    pendingExecution: "PENDING",
    bankTransferPending: "PENDING",
    refunded: "SETTLED",
    cancelled: "CANCELLED",
    failed: "ERROR",
    refused: "REFUSED",
    rejected: "ERROR",
    error: "ERROR",
    returned: "ERROR",
  };
  return map[status] ?? "PENDING";
}

const PAYOUT_STATUS_MAP: Record<string, "PAID" | "SCHEDULED" | "FAILED" | "PENDING"> = {
  booked: "PAID",
  pendingApproval: "SCHEDULED",
  authorised: "SCHEDULED",
  failed: "FAILED",
  refused: "FAILED",
  returned: "FAILED",
  internallyDeclined: "FAILED",
  validationFailed: "FAILED",
};

/**
 * Pulls real payout and transaction history from Adyen for a seeded org
 * and upserts it into the local DB so the financials dashboard shows accurate
 * data without requiring live webhook events.
 *
 * Requires ADYEN_PLATFORM_API_KEY to have "Balance Platform Transfers read"
 * permission — see docs/SEEDING.md § "Adyen Test Accounts".
 */
async function syncAdyenDataForOrg(
  orgId: string,
  balanceAccountId: string,
  sweepId: string
): Promise<{ transactions: number; payouts: number }> {
  let txnCount = 0;
  let payoutCount = 0;

  // ---- 1. platformPayment transfers → Transaction records ----
  // Wrapped independently so a permission error here does not block payout sync below.
  try {
    const platPayTransfers = await listBalanceAccountTransfers(balanceAccountId, {
      category: "platformPayment",
      createdSince: new Date("2020-01-01"),
    });

    for (const transfer of platPayTransfers) {
      const catData = transfer.categoryData as any;

      // Only sync net amounts credited to the org — skip fee/commission split entries
      if (catData?.platformPaymentType !== "BalanceAccount") continue;

      // Use modification PSP ref for captures/refunds/chargebacks; original PSP ref for payments
      const transferType = transfer.type as string;
      const pspReference: string | undefined =
        transferType === "payment"
          ? (catData?.pspPaymentReference ?? undefined)
          : (catData?.modificationPspReference ?? catData?.pspPaymentReference ?? undefined);

      if (!pspReference) continue;

      const txnType = mapTransferTypeToTxnType(transferType);
      if (!txnType) continue;

      const txnStatus = mapTransferStatusToTxnStatus(transfer.status as string);
      const amount = (transfer.amount?.value ?? 0) / 100;
      const currency = transfer.amount?.currency ?? "USD";
      const settledAt =
        txnStatus === "SETTLED" && transfer.createdAt ? new Date(transfer.createdAt) : null;

      await prisma.transaction.upsert({
        where: { pspReference },
        update: {
          status: txnStatus,
          ...(settledAt ? { settledAt } : {}),
        },
        create: {
          organizationId: orgId,
          pspReference,
          merchantRef: catData?.paymentMerchantReference ?? null,
          type: txnType,
          amount,
          currency,
          status: txnStatus,
          settledAt,
          // method (card brand) is not available from the Balance Platform Transfers API;
          // it is only present in the standard payment webhook notification.
        },
      });
      txnCount++;
    }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.status;
    if (status === 401 || status === 403) {
      console.warn(
        `  ⚠ transactions skipped — ADYEN_PLATFORM_API_KEY may need` +
          ` "Balance Platform Transfers read" permission. See docs/SEEDING.md.`
      );
    } else {
      console.warn(`  ⚠ transaction sync failed — ${err?.message ?? err}`);
    }
  }

  // ---- 2. bank transfers → Payout records ----
  const bankTransfers = await listBalanceAccountTransfers(balanceAccountId, {
    category: "bank",
    createdSince: new Date("2020-01-01"),
  });

  const sweepDescription = await getBalanceAccountSweepDescription(balanceAccountId, sweepId).catch(
    () => null
  );

  // Cache TI → last4 to avoid redundant API calls per org
  const tiLast4Cache = new Map<string, string | null>();

  for (const transfer of bankTransfers) {
    const statusStr = (
      typeof transfer.status === "object" ? transfer.status?.statusCode : transfer.status
    ) as string;
    const payoutStatus = PAYOUT_STATUS_MAP[statusStr ?? ""] ?? "PENDING";
    const amount = (transfer.amount?.value ?? 0) / 100;
    const currency = transfer.amount?.currency ?? "USD";
    const payoutType = seedDeterminePayoutType(transfer.description, sweepDescription);
    const transferDate = transfer.createdAt ? new Date(transfer.createdAt) : new Date();

    let bankAccount: string | null = null;
    const tiId: string | undefined = transfer.counterparty?.transferInstrumentId;
    if (tiId) {
      if (!tiLast4Cache.has(tiId)) {
        tiLast4Cache.set(tiId, await getTransferInstrumentLast4(tiId).catch(() => null));
      }
      bankAccount = tiLast4Cache.get(tiId) ?? null;
    }

    const updateFields = {
      status: payoutStatus,
      payoutType,
      ...(bankAccount ? { bankAccount } : {}),
      ...(payoutStatus === "PAID" ? { paidAt: transferDate } : {}),
      ...(payoutStatus === "SCHEDULED" ? { scheduledAt: transferDate } : {}),
    };

    const payout = await prisma.payout.upsert({
      where: { reference: transfer.id },
      update: updateFields,
      create: {
        organizationId: orgId,
        reference: transfer.id,
        amount,
        fees: 0,
        net: amount,
        currency,
        ...updateFields,
      },
    });
    payoutCount++;

    // Link settled transactions to PAID payouts using paidAt as the cutoff
    if (payoutStatus === "PAID" && payout.paidAt) {
      await prisma.transaction.updateMany({
        where: {
          organizationId: orgId,
          status: "SETTLED",
          payoutId: null,
          settledAt: { lte: payout.paidAt },
        },
        data: { payoutId: payout.id },
      });
    }
  }

  return { transactions: txnCount, payouts: payoutCount };
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Starting development seed...\n");

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================
  console.log("📋 Creating subscription plans...");

  // Use slug for where clause to be idempotent regardless of IDs
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "free" },
    update: {
      // Update existing plans with email limits
      emailIncluded: null, // No email campaigns on free plan
      emailOverageRate: null,
      maxStorageMB: 500, // 500 MB
      maxMembershipTypes: 2,
      featureToggles: {
        events: false,
        sms: false,
        emailCampaigns: false,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: false,
        memberships: false,
        waitlists: false,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
    },
    create: {
      name: "Free",
      slug: "free",
      description: "Perfect for getting started",
      monthlyPrice: 0,
      yearlyPrice: 0,
      transactionFee: 0.05,
      perTransactionFee: 0.5,
      maxAthletes: 25,
      maxUsers: 2,
      maxPrograms: 3,
      maxEvents: 10,
      smsIncluded: null,
      smsOverageRate: null,
      emailIncluded: null,
      emailOverageRate: null, // No email campaigns on free plan
      maxStorageMB: 500, // 500 MB
      maxMembershipTypes: 2,
      features: ["Basic scheduling", "Up to 25 athletes", "Email support", "500 MB storage"],
      featureToggles: {
        events: false,
        sms: false,
        emailCampaigns: false,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: false,
        memberships: false,
        waitlists: false,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 0,
      isActive: true,
      isPublic: true,
    },
  });
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "starter" },
    update: {
      emailIncluded: 500, // 500 emails/month
      emailOverageRate: 0.005, // $0.005 per email over limit
      maxStorageMB: 2000, // 2 GB
      maxMembershipTypes: 5,
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: true,
        memberships: false,
        waitlists: true,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
    },
    create: {
      name: "Starter",
      slug: "starter",
      description: "For growing organizations",
      monthlyPrice: 49,
      yearlyPrice: 470,
      transactionFee: 0.035,
      perTransactionFee: 0.35,
      maxAthletes: 100,
      maxUsers: 5,
      maxPrograms: 10,
      maxEvents: 50,
      smsIncluded: 100,
      smsOverageRate: 0.05,
      emailIncluded: 500,
      emailOverageRate: 0.005, // 500 emails/month, $0.005 per extra
      maxStorageMB: 2000, // 2 GB
      maxMembershipTypes: 5,
      features: [
        "Advanced scheduling",
        "Up to 100 athletes",
        "Priority email support",
        "Basic reporting",
        "500 email campaigns/month",
        "2 GB storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: true,
        memberships: false,
        waitlists: true,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 1,
      isActive: true,
      isPublic: true,
    },
  });
  const goldPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "gold" },
    update: {
      emailIncluded: 2500, // 2500 emails/month
      emailOverageRate: 0.003, // $0.003 per email over limit
      maxStorageMB: 10000, // 10 GB
      maxMembershipTypes: 15,
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: false,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
        competitions: true,
        reports: true,
      },
    },
    create: {
      name: "Gold",
      slug: "gold",
      description: "Most popular for established clubs",
      monthlyPrice: 149,
      yearlyPrice: 1430,
      transactionFee: 0.029,
      perTransactionFee: 0.3,
      maxAthletes: 500,
      maxUsers: 15,
      maxPrograms: 50,
      maxEvents: null,
      smsIncluded: 500,
      smsOverageRate: 0.04,
      emailIncluded: 2500,
      emailOverageRate: 0.003, // 2500 emails/month, $0.003 per extra
      maxStorageMB: 10000, // 10 GB
      maxMembershipTypes: 15,
      features: [
        "Unlimited events",
        "Up to 500 athletes",
        "Phone support",
        "Advanced reporting",
        "Custom branding",
        "2,500 email campaigns/month",
        "10 GB storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: false,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
        competitions: true,
        reports: true,
      },
      isPopular: true,
      displayOrder: 2,
      isActive: true,
      isPublic: true,
    },
  });
  const platinumPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "platinum" },
    update: {
      emailIncluded: 10000, // 10000 emails/month
      emailOverageRate: 0.002, // $0.002 per email over limit
      maxStorageMB: null, // Unlimited
      maxMembershipTypes: null, // Unlimited
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: true,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
      },
    },
    create: {
      name: "Platinum",
      slug: "platinum",
      description: "Enterprise-grade solution",
      monthlyPrice: 349,
      yearlyPrice: 3350,
      transactionFee: 0.025,
      perTransactionFee: 0.25,
      maxAthletes: null,
      maxUsers: null,
      maxPrograms: null,
      maxEvents: null,
      smsIncluded: 2000,
      smsOverageRate: 0.03,
      emailIncluded: 10000,
      emailOverageRate: 0.002, // 10000 emails/month, $0.002 per extra
      maxStorageMB: null, // Unlimited
      maxMembershipTypes: null, // Unlimited
      features: [
        "Unlimited everything",
        "Dedicated support",
        "Custom integrations",
        "White-label options",
        "SLA guarantee",
        "10,000 email campaigns/month",
        "Unlimited storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: true,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 3,
      isActive: true,
      isPublic: true,
    },
  });
  console.log("  ✓ Created 4 subscription plans");

  // ============================================
  // ORGANIZATIONS
  // ============================================
  console.log("\n🏢 Creating organizations...");
  const org1 = await prisma.organization.upsert({
    where: { id: ORG1_ID },
    update: {},
    create: {
      id: ORG1_ID,
      name: "Sunrise Skating Club",
      slug: "sunrise-skating",
      email: "info@sunriseskating.com",
      phone: "+15551234567",
      street: "100 Sunrise Blvd",
      city: "Austin",
      stateProvince: "TX",
      postalCode: "78701",
      country: "US",
      // Skate Canada section code, used for CSS competition exports
      federationSection: "ON",
    },
  });
  console.log(`  ✓ Created: ${org1.name}`);

  // Demo Skating and Uplifter (from original seed.ts)
  const orgDemo = await prisma.organization.upsert({
    where: { slug: "demo-gym" },
    update: {},
    create: {
      id: ORG_DEMO_ID,
      name: "Demo Skating Club",
      slug: "demo-gym",
      email: "demo@demogym.com",
      phone: "+15550001111",
      street: "500 Demo Lane",
      city: "Portland",
      stateProvince: "OR",
      postalCode: "97201",
      country: "US",
    },
  });
  const orgUplifter = await prisma.organization.upsert({
    where: { slug: "uplifter" },
    update: {},
    create: {
      id: ORG_UPLIFTER_ID,
      name: "Uplifter",
      slug: "uplifter",
      email: "admin@uplifterinc.com",
      phone: "+15550009999",
      street: "1 Platform Plaza",
      city: "San Francisco",
      stateProvince: "CA",
      postalCode: "94105",
      country: "US",
    },
  });
  console.log(`  ✓ Created: ${orgDemo.name}`);
  console.log(`  ✓ Created: ${orgUplifter.name}`);

  // ============================================
  // ADYEN PLATFORM ACCOUNTS
  // ============================================
  // Both orgs map to real accounts in the Adyen TEST environment (KirraCapital_Leapfrog_LOCAL_TEST).
  // See docs/SEEDING.md § "Adyen Test Accounts" for Customer Area links and verification steps.
  console.log("\n🏦 Creating Adyen platform accounts...");

  const sunriseAdyenData = {
    legalEntityId: "LE329CB223227L5P8Z836B2C3",
    businessLineId: "SE329CB223227L5P8Z836B2GP",
    accountHolderId: "AH3292V22322BK5P8Z8364KJM",
    balanceAccountId: "BA3292V22322BK5P8Z8374KKP",
    storeId: "ST32CSW223229T5P7L2K9547D",
    storeReference: "store-sunrise-skating",
    splitConfigurationId: "SCNF42988223225J5P8Z8HP2HM2624",
    sweepId: "SWPC4299322322445P8Z8GSFFB4BNG",
    transferInstrumentId: "SE329CB223227L5P8Z878B73G",
    onboardingStatus: "VERIFIED" as const,
    verificationStatus: "All capabilities verified",
    verifiedAt: new Date(),
    legalNameConfirmedAt: new Date(),
    platformFeeAcknowledgedAt: new Date(),
    platformAgreementAcceptedAt: new Date(),
    payoutSchedule: "weekly",
    capabilities: {
      receivePayments: {
        requested: true,
        allowed: true,
        enabled: true,
        verificationStatus: "valid",
      },
      sendToBalanceAccount: {
        requested: true,
        allowed: true,
        enabled: true,
        verificationStatus: "valid",
      },
      sendToTransferInstrument: {
        requested: true,
        allowed: true,
        enabled: true,
        verificationStatus: "valid",
        transferInstruments: [
          {
            id: "SE329CB223227L5P8Z878B73G",
            allowed: true,
            enabled: true,
            requested: true,
            verificationStatus: "valid",
          },
        ],
      },
      receiveFromBalanceAccount: {
        requested: true,
        allowed: true,
        enabled: true,
        verificationStatus: "valid",
      },
      receiveFromPlatformPayments: {
        requested: true,
        allowed: true,
        enabled: true,
        verificationStatus: "valid",
      },
    },
  };

  await prisma.adyenPlatformAccount.upsert({
    where: { organizationId: ORG1_ID },
    update: sunriseAdyenData,
    create: { organizationId: ORG1_ID, ...sunriseAdyenData },
  });

  // Demo Skating and Uplifter: no Adyen accounts
  await prisma.adyenPlatformAccount.deleteMany({
    where: { organizationId: { in: [ORG_DEMO_ID, ORG_UPLIFTER_ID] } },
  });

  console.log("  ✓ Sunrise Skating: VERIFIED (AH3292V22322BK5P8Z8364KJM, weekly sweep)");
  console.log("  ✓ Demo Skating / Uplifter: no account");

  // ============================================
  // ADYEN DATA SYNC (transactions + payouts)
  // ============================================
  // Pulls real history from Adyen's Transfers API so the financials dashboard
  // shows accurate data without requiring live webhook events after seeding.
  // Requires ADYEN_PLATFORM_API_KEY to have "Balance Platform Transfers read"
  // permission. If missing, this section is skipped gracefully.
  console.log("\n📡 Syncing Adyen transaction and payout history...");

  if (!isPlatformConfigured()) {
    console.log("  ⚠ Adyen platform not fully configured — skipping sync");
  } else {
    const orgsToSync = [
      {
        orgId: ORG1_ID,
        balanceAccountId: "BA3292V22322BK5P8Z8374KKP",
        sweepId: "SWPC4299322322445P8Z8GSFFB4BNG",
        label: "Sunrise",
      },
    ] as const;

    let totalTxns = 0;
    let totalPayouts = 0;

    for (const { orgId, balanceAccountId, sweepId, label } of orgsToSync) {
      try {
        const { transactions, payouts } = await syncAdyenDataForOrg(
          orgId,
          balanceAccountId,
          sweepId
        );
        console.log(`  ✓ ${label}: synced ${transactions} transactions, ${payouts} payouts`);
        totalTxns += transactions;
        totalPayouts += payouts;
      } catch (err: any) {
        console.warn(`  ⚠ ${label}: payout sync failed — ${err?.message ?? err}`);
      }
    }

    if (totalTxns > 0 || totalPayouts > 0) {
      console.log(`  ✓ Total synced: ${totalTxns} transactions, ${totalPayouts} payouts`);
    }
  }

  // ============================================
  // ORGANIZATION SUBSCRIPTIONS
  // ============================================
  console.log("\n💳 Creating organization subscriptions...");
  await Promise.all([
    prisma.organizationSubscription.upsert({
      where: { organizationId: ORG1_ID },
      update: {},
      create: {
        organizationId: ORG1_ID,
        planId: goldPlan.id,
        status: "ACTIVE",
        billingCycle: "YEARLY",
        currentPeriodStart: daysAgo(30),
        currentPeriodEnd: daysFromNow(335),
      },
    }),
    prisma.organizationSubscription.upsert({
      where: { organizationId: orgDemo.id },
      update: {},
      create: {
        organizationId: orgDemo.id,
        planId: goldPlan.id,
        status: "ACTIVE",
        billingCycle: "MONTHLY",
        currentPeriodStart: daysAgo(10),
        currentPeriodEnd: daysFromNow(20),
      },
    }),
    prisma.organizationSubscription.upsert({
      where: { organizationId: orgUplifter.id },
      update: {},
      create: {
        organizationId: orgUplifter.id,
        planId: platinumPlan.id,
        status: "ACTIVE",
        billingCycle: "YEARLY",
        currentPeriodStart: daysAgo(60),
        currentPeriodEnd: daysFromNow(305),
      },
    }),
  ]);
  console.log("  ✓ Created subscriptions for all organizations");

  // ============================================
  // COMPETITION CATEGORY TEMPLATES
  // ============================================
  console.log("\n🏷️  Creating competition category templates...");

  // --- Figure Skating: Age Group x Discipline (COMBINATION) ---
  const skatingTemplate = await prisma.competitionCategoryTemplate.upsert({
    where: { id: "cat-tmpl-skating-age-discipline" },
    update: {},
    create: {
      id: "cat-tmpl-skating-age-discipline",
      name: "Age Group x Discipline",
      description:
        "Standard figure skating competition categories organized by age group and discipline",
      type: "COMBINATION",
      isActive: true,
      displayOrder: 0,
      rowAxisLabel: "Age Group",
      columnAxisLabel: "Discipline",
      restrictionAxis: "ROW",
    },
  });

  const skatingRowData = [
    {
      id: "cav-skate-u8",
      name: "Under 8",
      axis: "ROW" as const,
      displayOrder: 0,
      minAge: 0,
      maxAge: 7,
    },
    {
      id: "cav-skate-u10",
      name: "Under 10",
      axis: "ROW" as const,
      displayOrder: 1,
      minAge: 8,
      maxAge: 9,
    },
    {
      id: "cav-skate-u12",
      name: "Under 12",
      axis: "ROW" as const,
      displayOrder: 2,
      minAge: 10,
      maxAge: 11,
    },
    {
      id: "cav-skate-u14",
      name: "Under 14",
      axis: "ROW" as const,
      displayOrder: 3,
      minAge: 12,
      maxAge: 13,
    },
    {
      id: "cav-skate-open",
      name: "Open",
      axis: "ROW" as const,
      displayOrder: 4,
      minAge: 14,
      maxAge: null,
    },
  ];
  const skatingColData = [
    {
      id: "cav-skate-free-skate",
      name: "Free Skate",
      axis: "COLUMN" as const,
      displayOrder: 0,
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
    },
    {
      id: "cav-skate-short-program",
      name: "Short Program",
      axis: "COLUMN" as const,
      displayOrder: 1,
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
    },
    {
      id: "cav-skate-moves",
      name: "Moves in the Field",
      axis: "COLUMN" as const,
      displayOrder: 2,
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
    },
    {
      id: "cav-skate-showcase",
      name: "Showcase",
      axis: "COLUMN" as const,
      displayOrder: 3,
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
    },
  ];

  for (const row of skatingRowData) {
    await prisma.categoryAxisValue.upsert({
      where: { id: row.id },
      update: {},
      create: { ...row, templateId: skatingTemplate.id },
    });
  }
  for (const col of skatingColData) {
    await prisma.categoryAxisValue.upsert({
      where: { id: col.id },
      update: {},
      create: { ...col, templateId: skatingTemplate.id },
    });
  }

  // Generate combination entries (disable Under 8 - Short Program — too young for separate SP/FS)
  const skatingDisabled = new Set(["cav-skate-u8:cav-skate-short-program"]);
  for (const row of skatingRowData) {
    for (const col of skatingColData) {
      const comboId = `combo-skate-${row.id}-${col.id}`;
      const key = `${row.id}:${col.id}`;
      await prisma.categoryCombinationEntry.upsert({
        where: { id: comboId },
        update: {},
        create: {
          id: comboId,
          templateId: skatingTemplate.id,
          rowValueId: row.id,
          colValueId: col.id,
          isActive: !skatingDisabled.has(key),
          name: `${row.name} - ${col.name}`,
        },
      });
    }
  }
  console.log("  ✓ Created Figure Skating: Age Group x Discipline template");
  // --- Swimming: Open Events (INDIVIDUAL) ---
  const swimTemplate = await prisma.competitionCategoryTemplate.upsert({
    where: { id: "cat-tmpl-swimming-open-events" },
    update: {},
    create: {
      id: "cat-tmpl-swimming-open-events",
      name: "Open Events",
      description: "Standard open swimming events with age-based restrictions",
      type: "INDIVIDUAL",
      isActive: true,
      displayOrder: 0,
    },
  });

  const swimEntries = [
    {
      id: "cie-swim-50free",
      name: "50m Freestyle",
      displayOrder: 0,
      hasAgeRestriction: false,
      minAge: null,
      maxAge: null,
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
    },
    {
      id: "cie-swim-100back",
      name: "100m Backstroke",
      displayOrder: 1,
      hasAgeRestriction: true,
      minAge: 8,
      maxAge: null,
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
    },
    {
      id: "cie-swim-200medley",
      name: "200m Medley",
      displayOrder: 2,
      hasAgeRestriction: true,
      minAge: 10,
      maxAge: null,
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
    },
    {
      id: "cie-swim-4x50relay",
      name: "4x50m Relay",
      displayOrder: 3,
      hasAgeRestriction: false,
      minAge: null,
      maxAge: null,
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
    },
  ];

  for (const entry of swimEntries) {
    await prisma.categoryIndividualEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        ...entry,
        templateId: swimTemplate.id,
        hasGenderRestriction: false,
        hasCapacityRestriction: false,
      },
    });
  }
  console.log("  ✓ Created Swimming: Open Events template");

  // ============================================
  // USERS
  // ============================================
  console.log("\n👤 Creating users...");
  const org1Admin = await prisma.user.upsert({
    where: { email: "admin@sunrise-skating.com" },
    update: {},
    create: {
      email: "admin@sunrise-skating.com",
      name: "Jennifer Walsh",
      passwordHash: null,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const org1Coach1 = await prisma.user.upsert({
    where: { email: "coach.maria@sunrise-skating.com" },
    update: {},
    create: {
      email: "coach.maria@sunrise-skating.com",
      name: "Maria Rodriguez",
      passwordHash: null,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  const org1Coach2 = await prisma.user.upsert({
    where: { email: "coach.james@sunrise-skating.com" },
    update: {},
    create: {
      email: "coach.james@sunrise-skating.com",
      name: "James Chen",
      passwordHash: null,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  const org1Accountant = await prisma.user.upsert({
    where: { email: "finance@sunrise-skating.com" },
    update: {},
    create: {
      email: "finance@sunrise-skating.com",
      name: "Robert Kim",
      passwordHash: null,
      role: "ACCOUNTANT",
      status: "ACTIVE",
    },
  });
  const org1Coach3 = await prisma.user.upsert({
    where: { email: "coach.ava@sunrise-skating.com" },
    update: {},
    create: {
      email: "coach.ava@sunrise-skating.com",
      name: "Ava Patel",
      passwordHash: null,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  // Demo Skating and Uplifter users (from original seed.ts)
  const andrewUser = await prisma.user.upsert({
    where: { email: "andrewkarzel@uplifterinc.com" },
    update: { isSuperAdmin: true },
    create: {
      email: "andrewkarzel@uplifterinc.com",
      name: "Andrew Karzel",
      passwordHash: null,
      role: "ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
    },
  });
  const drewUser = await prisma.user.upsert({
    where: { email: "drew.williams@uplifterinc.com" },
    update: { isSuperAdmin: true },
    create: {
      email: "drew.williams@uplifterinc.com",
      name: "Drew Williams",
      passwordHash: null,
      role: "ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
    },
  });
  const okechiUser = await prisma.user.upsert({
    where: { email: "okechi.onyeje@uplifterinc.com" },
    update: { isSuperAdmin: true },
    create: {
      email: "okechi.onyeje@uplifterinc.com",
      name: "Okechi Onyeje",
      passwordHash: null,
      role: "ADMIN",
      status: "ACTIVE",
      isSuperAdmin: true,
    },
  });
  const demoAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash: null,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoCoach = await prisma.user.upsert({
    where: { email: "coach@demo.com" },
    update: {},
    create: {
      email: "coach@demo.com",
      name: "Sarah Coach",
      passwordHash: null,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  console.log("  ✓ Created 10 users across all organizations");

  // ============================================
  // ORGANIZATION MEMBERS
  // ============================================
  console.log("\n👥 Creating organization memberships...");
  const org1AdminMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Admin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG1_ID}-member-admin`,
      organizationId: ORG1_ID,
      userId: org1Admin.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const org1Coach1Member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Coach1.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: {
      id: `${ORG1_ID}-staff-1`,
      organizationId: ORG1_ID,
      userId: org1Coach1.id,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  const org1Coach2Member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Coach2.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: {
      id: `${ORG1_ID}-staff-2`,
      organizationId: ORG1_ID,
      userId: org1Coach2.id,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  const org1AccountantMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Accountant.id } },
    update: { role: "ACCOUNTANT", status: "ACTIVE" },
    create: {
      id: `${ORG1_ID}-staff-3`,
      organizationId: ORG1_ID,
      userId: org1Accountant.id,
      role: "ACCOUNTANT",
      status: "ACTIVE",
    },
  });
  const org1Coach3Member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Coach3.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: {
      id: `${ORG1_ID}-staff-4`,
      organizationId: ORG1_ID,
      userId: org1Coach3.id,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  // Demo Skating and Uplifter memberships
  const uplifterAndrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgUplifter.id, userId: andrewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_UPLIFTER_ID}-member-andrew`,
      organizationId: orgUplifter.id,
      userId: andrewUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoAndrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: andrewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_DEMO_ID}-member-andrew`,
      organizationId: orgDemo.id,
      userId: andrewUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const uplifterDrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgUplifter.id, userId: drewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_UPLIFTER_ID}-member-drew`,
      organizationId: orgUplifter.id,
      userId: drewUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoDrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: drewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_DEMO_ID}-member-drew`,
      organizationId: orgDemo.id,
      userId: drewUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const uplifterOkechiMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgUplifter.id, userId: okechiUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_UPLIFTER_ID}-member-okechi`,
      organizationId: orgUplifter.id,
      userId: okechiUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoOkechiMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: okechiUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_DEMO_ID}-member-okechi`,
      organizationId: orgDemo.id,
      userId: okechiUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoAdminMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: demoAdmin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      id: `${ORG_DEMO_ID}-member-admin`,
      organizationId: orgDemo.id,
      userId: demoAdmin.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const demoCoachMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: demoCoach.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: {
      id: `${ORG_DEMO_ID}-member-coach`,
      organizationId: orgDemo.id,
      userId: demoCoach.id,
      role: "COACH",
      status: "ACTIVE",
    },
  });
  console.log("  ✓ Created 12 organization memberships");

  // ============================================
  // MEMBER PERMISSIONS
  // ============================================
  console.log("\n🔐 Creating member permissions...");
  const permissionData = [
    { memberId: org1AdminMember.id, permission: "*" },
    { memberId: org1Coach1Member.id, permission: "dashboard.view" },
    { memberId: org1Coach1Member.id, permission: "athletes.view" },
    { memberId: org1Coach1Member.id, permission: "athletes.edit" },
    { memberId: org1Coach1Member.id, permission: "training.view" },
    { memberId: org1Coach1Member.id, permission: "training.create" },
    { memberId: org1Coach1Member.id, permission: "events.view" },
    { memberId: org1Coach1Member.id, permission: "coaching.portal" },
    { memberId: org1Coach1Member.id, permission: "coaching.assign" },
    { memberId: org1Coach1Member.id, permission: "coaching.attendance" },
    { memberId: org1Coach1Member.id, permission: "coaching.evaluations" },
    { memberId: org1Coach2Member.id, permission: "dashboard.view" },
    { memberId: org1Coach2Member.id, permission: "athletes.view" },
    { memberId: org1Coach2Member.id, permission: "training.view" },
    { memberId: org1Coach2Member.id, permission: "coaching.portal" },
    { memberId: org1Coach2Member.id, permission: "coaching.assign" },
    { memberId: org1Coach2Member.id, permission: "coaching.attendance" },
    { memberId: org1Coach3Member.id, permission: "dashboard.view" },
    { memberId: org1Coach3Member.id, permission: "athletes.view" },
    { memberId: org1Coach3Member.id, permission: "training.view" },
    { memberId: org1Coach3Member.id, permission: "coaching.portal" },
    { memberId: org1Coach3Member.id, permission: "coaching.assign" },
    { memberId: org1Coach3Member.id, permission: "coaching.attendance" },
    { memberId: org1AccountantMember.id, permission: "dashboard.view" },
    { memberId: org1AccountantMember.id, permission: "financials.view" },
    { memberId: org1AccountantMember.id, permission: "financials.edit" },
    { memberId: org1AccountantMember.id, permission: "invoices.view" },
    { memberId: org1AccountantMember.id, permission: "invoices.create" },
    // Demo Skating and Uplifter permissions
    { memberId: uplifterAndrewMember.id, permission: "*" },
    { memberId: demoAndrewMember.id, permission: "*" },
    { memberId: uplifterDrewMember.id, permission: "*" },
    { memberId: demoDrewMember.id, permission: "*" },
    { memberId: uplifterOkechiMember.id, permission: "*" },
    { memberId: demoOkechiMember.id, permission: "*" },
    { memberId: demoAdminMember.id, permission: "*" },
    { memberId: demoCoachMember.id, permission: "dashboard.view" },
    { memberId: demoCoachMember.id, permission: "athletes.view" },
    { memberId: demoCoachMember.id, permission: "athletes.edit" },
    { memberId: demoCoachMember.id, permission: "training.view" },
    { memberId: demoCoachMember.id, permission: "training.create" },
    { memberId: demoCoachMember.id, permission: "training.edit" },
    { memberId: demoCoachMember.id, permission: "events.view" },
    { memberId: demoCoachMember.id, permission: "events.create" },
    { memberId: demoCoachMember.id, permission: "events.edit" },
    { memberId: demoCoachMember.id, permission: "coaching.portal" },
    { memberId: demoCoachMember.id, permission: "coaching.assign" },
    { memberId: demoCoachMember.id, permission: "coaching.attendance" },
    { memberId: demoCoachMember.id, permission: "coaching.evaluations" },
  ];
  for (const p of permissionData) {
    await prisma.orgMemberPermission.upsert({
      where: { memberId_permission: { memberId: p.memberId, permission: p.permission } },
      update: {},
      create: { memberId: p.memberId, permission: p.permission },
    });
  }
  console.log(`  ✓ Created ${permissionData.length} member permissions`);

  // ============================================
  // FACILITIES
  // ============================================
  console.log("\n🏢 Creating facilities...");
  const org1Facility1 = await prisma.facility.upsert({
    where: { id: `${ORG1_ID}-facility-main` },
    update: {},
    create: {
      id: `${ORG1_ID}-facility-main`,
      organizationId: ORG1_ID,
      name: "Sunrise Main Gym",
      street: "123 Ice Rink Way",
      city: "Sunnyvale",
      stateProvince: "CA",
      postalCode: "94086",
      country: "USA",
      phone: "(555) 100-1000",
      email: "info@sunrise-skating.com",
      status: "ACTIVE",
      isDefault: true,
      squareFootage: 15000,
      maxCapacity: 200,
      description: "Our main training rink with full ice surface and off-ice training area",
    },
  });
  const org1Facility2 = await prisma.facility.upsert({
    where: { id: `${ORG1_ID}-facility-satellite` },
    update: {},
    create: {
      id: `${ORG1_ID}-facility-satellite`,
      organizationId: ORG1_ID,
      name: "Sunrise Satellite Studio",
      street: "456 Flip Lane",
      city: "Mountain View",
      stateProvince: "CA",
      postalCode: "94040",
      country: "USA",
      phone: "(555) 100-2000",
      email: "satellite@sunrise-skating.com",
      status: "ACTIVE",
      isDefault: false,
      squareFootage: 5000,
      maxCapacity: 60,
      description: "Smaller studio for preschool and recreational classes",
    },
  });
  console.log("  ✓ Created 2 facilities");

  // ============================================
  // SPACES
  // ============================================
  console.log("\n🏋️ Creating spaces...");
  const spaceData = [
    // Org1 Main Facility
    {
      id: `${ORG1_ID}-space-1`,
      facilityId: org1Facility1.id,
      name: "Main Floor",
      capacity: 50,
      status: "OPEN" as const,
    },
    {
      id: `${ORG1_ID}-space-2`,
      facilityId: org1Facility1.id,
      name: "Practice Ice B",
      capacity: 15,
      status: "OPEN" as const,
    },
    {
      id: `${ORG1_ID}-space-3`,
      facilityId: org1Facility1.id,
      name: "Uneven Bars",
      capacity: 20,
      status: "MAINTENANCE" as const,
    },
    {
      id: `${ORG1_ID}-space-4`,
      facilityId: org1Facility1.id,
      name: "Beam Area",
      capacity: 25,
      status: "OPEN" as const,
    },
    {
      id: `${ORG1_ID}-space-5`,
      facilityId: org1Facility1.id,
      name: "Tumble Track",
      capacity: 10,
      status: "OPEN" as const,
    },
    // Org1 Satellite Facility
    {
      id: `${ORG1_ID}-space-6`,
      facilityId: org1Facility2.id,
      name: "Preschool Area",
      capacity: 30,
      status: "OPEN" as const,
    },
    {
      id: `${ORG1_ID}-space-7`,
      facilityId: org1Facility2.id,
      name: "Recreational Ice",
      capacity: 25,
      status: "OPEN" as const,
    },
  ];
  await Promise.all(
    spaceData.map((z) =>
      prisma.space.upsert({
        where: { id: z.id },
        update: {},
        create: z,
      })
    )
  );
  console.log(`  ✓ Created ${spaceData.length} spaces`);

  // ============================================
  // SPACE AVAILABILITY
  // ============================================
  console.log("\n🕐 Creating space availability hours...");
  const spaceAvailabilityData = [
    // Org1 Main Facility - Main Floor: Mon-Fri 7am-9pm, Sat 8am-5pm
    ...[1, 2, 3, 4, 5].map((day) => ({
      spaceId: `${ORG1_ID}-space-1`,
      dayOfWeek: day,
      openTime: "07:00",
      closeTime: "21:00",
    })),
    { spaceId: `${ORG1_ID}-space-1`, dayOfWeek: 6, openTime: "08:00", closeTime: "17:00" },
    // Practice Ice B: Mon-Fri 8am-8pm
    ...[1, 2, 3, 4, 5].map((day) => ({
      spaceId: `${ORG1_ID}-space-2`,
      dayOfWeek: day,
      openTime: "08:00",
      closeTime: "20:00",
    })),
    // Beam Area: Mon-Sat 7am-9pm
    ...[1, 2, 3, 4, 5, 6].map((day) => ({
      spaceId: `${ORG1_ID}-space-4`,
      dayOfWeek: day,
      openTime: "07:00",
      closeTime: "21:00",
    })),
    // Tumble Track: Mon-Fri 9am-6pm
    ...[1, 2, 3, 4, 5].map((day) => ({
      spaceId: `${ORG1_ID}-space-5`,
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    })),
    // Org1 Satellite - Preschool Area: Mon-Fri 8am-4pm
    ...[1, 2, 3, 4, 5].map((day) => ({
      spaceId: `${ORG1_ID}-space-6`,
      dayOfWeek: day,
      openTime: "08:00",
      closeTime: "16:00",
    })),
    // Recreational Ice: Mon-Sat 7am-9pm
    ...[1, 2, 3, 4, 5, 6].map((day) => ({
      spaceId: `${ORG1_ID}-space-7`,
      dayOfWeek: day,
      openTime: "07:00",
      closeTime: "21:00",
    })),
  ];
  for (const slot of spaceAvailabilityData) {
    await prisma.spaceAvailability.upsert({
      where: {
        spaceId_dayOfWeek: {
          spaceId: slot.spaceId,
          dayOfWeek: slot.dayOfWeek,
        },
      },
      update: { openTime: slot.openTime, closeTime: slot.closeTime },
      create: slot,
    });
  }
  console.log(`  ✓ Created ${spaceAvailabilityData.length} availability slots`);

  // ============================================
  // EQUIPMENT
  // ============================================
  console.log("\n🎯 Creating equipment...");
  const equipmentData = [
    // Org1 Main Facility Equipment
    {
      id: `${ORG1_ID}-equip-1`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-1`,
      name: "Spring Floor A",
      condition: "GOOD" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(30),
    },
    {
      id: `${ORG1_ID}-equip-2`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-2`,
      name: "Vault Table (Tac/10)",
      condition: "EXCELLENT" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(15),
    },
    {
      id: `${ORG1_ID}-equip-3`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-3`,
      name: "Uneven Bars Set 1",
      condition: "FAIR" as const,
      status: "MAINTENANCE" as const,
      lastInspectionDate: daysAgo(60),
    },
    {
      id: `${ORG1_ID}-equip-4`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-4`,
      name: "High Beam 1",
      condition: "GOOD" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(45),
    },
    {
      id: `${ORG1_ID}-equip-5`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-4`,
      name: "High Beam 2",
      condition: "POOR" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(90),
    },
    {
      id: `${ORG1_ID}-equip-6`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-5`,
      name: "Tumble Track",
      condition: "GOOD" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(20),
    },
    {
      id: `${ORG1_ID}-equip-7`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-2`,
      name: "Landing Mat (Blue)",
      condition: "FAIR" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(40),
    },
    {
      id: `${ORG1_ID}-equip-8`,
      organizationId: ORG1_ID,
      facilityId: org1Facility1.id,
      spaceId: `${ORG1_ID}-space-4`,
      name: "Low Beam Training",
      condition: "GOOD" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(25),
    },
    // Org1 Satellite Equipment
    {
      id: `${ORG1_ID}-equip-9`,
      organizationId: ORG1_ID,
      facilityId: org1Facility2.id,
      spaceId: `${ORG1_ID}-space-6`,
      name: "Preschool Foam Shapes",
      condition: "EXCELLENT" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(10),
    },
    {
      id: `${ORG1_ID}-equip-10`,
      organizationId: ORG1_ID,
      facilityId: org1Facility2.id,
      spaceId: `${ORG1_ID}-space-7`,
      name: "Panel Mat Set",
      condition: "GOOD" as const,
      status: "ACTIVE" as const,
      lastInspectionDate: daysAgo(35),
    },
  ];
  await Promise.all(
    equipmentData.map((e) =>
      prisma.equipment.upsert({
        where: { id: e.id },
        update: {},
        create: e,
      })
    )
  );
  console.log(`  ✓ Created ${equipmentData.length} equipment items`);

  // ============================================
  // FACILITY ASSIGNMENTS
  // ============================================
  console.log("\n👷 Creating facility assignments...");
  const facilityAssignmentData = [
    {
      id: `${ORG1_ID}-assign-1`,
      facilityId: org1Facility1.id,
      userId: org1Coach1.id,
      isPrimary: true,
    },
    {
      id: `${ORG1_ID}-assign-2`,
      facilityId: org1Facility1.id,
      userId: org1Coach2.id,
      isPrimary: true,
    },
    {
      id: `${ORG1_ID}-assign-3`,
      facilityId: org1Facility2.id,
      userId: org1Coach1.id,
      isPrimary: false,
    },
  ];
  await Promise.all(
    facilityAssignmentData.map((a) =>
      prisma.facilityAssignment.upsert({
        where: { id: a.id },
        update: {},
        create: a,
      })
    )
  );
  console.log(`  ✓ Created ${facilityAssignmentData.length} facility assignments`);

  // ============================================
  // FACILITY OPERATING HOURS
  // ============================================
  console.log("\n🕐 Creating facility operating hours...");
  const operatingHoursData = [
    // Org1 Main Gym: Mon-Fri 6:00-21:00, Sat 8:00-18:00, Sun closed
    ...[1, 2, 3, 4, 5].map((day, i) => ({
      id: `${ORG1_ID}-hours-main-${i}`,
      facilityId: org1Facility1.id,
      dayOfWeek: day,
      openTime: "06:00",
      closeTime: "21:00",
    })),
    {
      id: `${ORG1_ID}-hours-main-sat`,
      facilityId: org1Facility1.id,
      dayOfWeek: 6,
      openTime: "08:00",
      closeTime: "18:00",
    },
    // Org1 Satellite: Mon-Fri 9:00-12:00 and 14:00-20:00 (closed for lunch), Sat 9:00-14:00
    ...[1, 2, 3, 4, 5].flatMap((day) => [
      {
        id: `${ORG1_ID}-hours-sat-${day}a`,
        facilityId: org1Facility2.id,
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "12:00",
      },
      {
        id: `${ORG1_ID}-hours-sat-${day}b`,
        facilityId: org1Facility2.id,
        dayOfWeek: day,
        openTime: "14:00",
        closeTime: "20:00",
      },
    ]),
    {
      id: `${ORG1_ID}-hours-sat-sat`,
      facilityId: org1Facility2.id,
      dayOfWeek: 6,
      openTime: "09:00",
      closeTime: "14:00",
    },
  ];
  await Promise.all(
    operatingHoursData.map((h) =>
      prisma.facilityOperatingHours.upsert({
        where: { id: h.id },
        update: {},
        create: h,
      })
    )
  );
  console.log(`  ✓ Created ${operatingHoursData.length} facility operating hours entries`);

  // ============================================
  // FACILITY NOTES
  // ============================================
  console.log("\n📝 Creating facility notes...");
  const facilityNoteData = [
    {
      id: `${ORG1_ID}-fnote-1`,
      facilityId: org1Facility1.id,
      authorId: org1Admin.id,
      content: "Annual fire inspection passed. Next inspection due March 2027.",
      createdAt: daysAgo(14),
    },
    {
      id: `${ORG1_ID}-fnote-2`,
      facilityId: org1Facility1.id,
      authorId: org1Coach1.id,
      content: "Foam pit needs refilling — ordered new foam blocks, expected delivery next week.",
      createdAt: daysAgo(7),
    },
    {
      id: `${ORG1_ID}-fnote-3`,
      facilityId: org1Facility1.id,
      authorId: org1Admin.id,
      content: "HVAC serviced — new filters installed, AC running much cooler now.",
      createdAt: daysAgo(3),
    },
    {
      id: `${ORG1_ID}-fnote-4`,
      facilityId: org1Facility2.id,
      authorId: org1Coach1.id,
      content: "Preschool area mats replaced with new anti-slip versions.",
      createdAt: daysAgo(21),
    },
    {
      id: `${ORG1_ID}-fnote-5`,
      facilityId: org1Facility2.id,
      authorId: org1Admin.id,
      content:
        "Parking lot repaving scheduled for the first weekend of next month. Classes will need to use the rear entrance.",
      createdAt: daysAgo(5),
    },
  ];
  await Promise.all(
    facilityNoteData.map((n) =>
      prisma.facilityNote.upsert({
        where: { id: n.id },
        update: {},
        create: n,
      })
    )
  );
  console.log(`  ✓ Created ${facilityNoteData.length} facility notes`);

  // ============================================
  // GUARDIAN / PARENT USERS
  // ============================================
  console.log("\n👨‍👩‍👧‍👦 Creating guardian users...");
  const org1Parent1 = await prisma.user.upsert({
    where: { email: "michelle.anderson@email.com" },
    update: {},
    create: {
      id: `${ORG1_ID}-parent-1`,
      email: "michelle.anderson@email.com",
      name: "Michelle Anderson",
      passwordHash: null,
      phone: "(555) 101-1001",
      role: "PARENT",
      status: "ACTIVE",
      balance: 0,
    },
  });
  const org1Parent2 = await prisma.user.upsert({
    where: { email: "thomas.baker@email.com" },
    update: {},
    create: {
      id: `${ORG1_ID}-parent-2`,
      email: "thomas.baker@email.com",
      name: "Thomas Baker",
      passwordHash: null,
      phone: "(555) 102-1002",
      role: "PARENT",
      status: "ACTIVE",
      balance: 150.0,
    },
  });
  const org1Parent3 = await prisma.user.upsert({
    where: { email: "lisa.chen@email.com" },
    update: {},
    create: {
      id: `${ORG1_ID}-parent-3`,
      email: "lisa.chen@email.com",
      name: "Lisa Chen",
      passwordHash: null,
      phone: "(555) 103-1003",
      role: "PARENT",
      status: "ACTIVE",
      balance: -25.0,
    },
  });
  const org1Parent4 = await prisma.user.upsert({
    where: { email: "marcus.davis@email.com" },
    update: {},
    create: {
      id: `${ORG1_ID}-parent-4`,
      email: "marcus.davis@email.com",
      name: "Marcus Davis",
      passwordHash: null,
      phone: "(555) 104-1004",
      role: "PARENT",
      status: "ACTIVE",
      balance: 0,
    },
  });
  const org1Parent5 = await prisma.user.upsert({
    where: { email: "nancy.evans@email.com" },
    update: {},
    create: {
      id: `${ORG1_ID}-parent-5`,
      email: "nancy.evans@email.com",
      name: "Nancy Evans",
      passwordHash: null,
      phone: "(555) 105-1005",
      role: "PARENT",
      status: "ACTIVE",
      balance: 75.5,
    },
  });
  console.log("  ✓ Created 5 guardian users");

  // ============================================
  // ATHLETES
  // ============================================
  console.log("\n🏃 Creating athletes...");
  await Promise.all([
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-1` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-1`,
        firstName: "Emily",
        lastName: "Anderson",
        email: "emily.a@email.com",
        birthDate: noonUTC("2016-03-15"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-2` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-2`,
        firstName: "Sophie",
        lastName: "Anderson",
        email: "sophie.a@email.com",
        birthDate: noonUTC("2014-07-22"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-3` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-3`,
        firstName: "Olivia",
        lastName: "Baker",
        birthDate: noonUTC("2013-11-08"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-4` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-4`,
        firstName: "Lily",
        lastName: "Chen",
        birthDate: noonUTC("2017-01-30"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-5` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-5`,
        firstName: "Mia",
        lastName: "Chen",
        birthDate: noonUTC("2012-09-14"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-6` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-6`,
        firstName: "Grace",
        lastName: "Davis",
        birthDate: noonUTC("2011-05-20"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-7` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-7`,
        firstName: "Ava",
        lastName: "Evans",
        birthDate: noonUTC("2015-12-03"),
        gender: "FEMALE",
      },
    }),
    prisma.athlete.upsert({
      where: { id: `${ORG1_ID}-ath-8` },
      update: {},
      create: {
        id: `${ORG1_ID}-ath-8`,
        firstName: "Hannah",
        lastName: "Evans",
        birthDate: noonUTC("2019-08-11"),
        gender: "FEMALE",
      },
    }),
  ]);
  console.log("  ✓ Created 8 athletes");

  // ============================================
  // ORGANIZATION-ATHLETE LINKS (with org-specific level, status, customId)
  // ============================================
  console.log("\n🔗 Creating organization-athlete links...");
  const orgAthleteData = [
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-1`,
      level: "Bronze",
      status: "ACTIVE" as const,
      customId: "SGA-001",
      federationName: "SKATE_CANADA",
      federationMemberNumber: "SC-20410001",
      federationMemberExpiresAt: daysFromNow(180),
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-2`,
      level: "Silver",
      status: "ACTIVE" as const,
      customId: "SGA-002",
      federationName: "SKATE_CANADA",
      federationMemberNumber: "SC-20410002",
      federationMemberExpiresAt: daysFromNow(220),
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-3`,
      level: "Competitive",
      status: "ACTIVE" as const,
      customId: "SGA-003",
      federationName: "SKATE_CANADA",
      federationMemberNumber: "SC-20410003",
      federationMemberExpiresAt: daysFromNow(310),
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-4`,
      level: "Bronze",
      status: "ACTIVE" as const,
      customId: "SGA-004",
      federationName: "SKATE_CANADA",
      federationMemberNumber: "SC-20410004",
      federationMemberExpiresAt: daysAgo(15), // sample expired membership
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-5`,
      level: "Gold",
      status: "ACTIVE" as const,
      customId: "SGA-005",
      federationName: "SKATE_CANADA",
      federationMemberNumber: "SC-20410005",
      federationMemberExpiresAt: daysFromNow(60),
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-6`,
      level: "Competitive",
      status: "ACTIVE" as const,
      customId: "SGA-006",
      federationName: "USFS",
      federationMemberNumber: "USFS-789123",
      federationMemberExpiresAt: daysFromNow(400),
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-7`,
      level: "Silver",
      status: "TRIAL" as const,
      customId: "SGA-007",
    },
    {
      organizationId: ORG1_ID,
      athleteId: `${ORG1_ID}-ath-8`,
      level: "Preschool",
      status: "ACTIVE" as const,
      customId: "SGA-008",
    },
  ];
  for (const oa of orgAthleteData) {
    await prisma.organizationAthlete.upsert({
      where: {
        organizationId_athleteId: { organizationId: oa.organizationId, athleteId: oa.athleteId },
      },
      update: {},
      create: oa,
    });
  }
  console.log(`  ✓ Created ${orgAthleteData.length} organization-athlete links`);

  // ============================================
  // ATHLETE GUARDIANS
  // ============================================
  console.log("\n👪 Creating athlete-guardian relationships...");
  const guardianData = [
    {
      athleteId: `${ORG1_ID}-ath-1`,
      userId: org1Parent1.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-2`,
      userId: org1Parent1.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-3`,
      userId: org1Parent2.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-4`,
      userId: org1Parent3.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-5`,
      userId: org1Parent3.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-6`,
      userId: org1Parent4.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-7`,
      userId: org1Parent5.id,
      relationship: "Parent",
      isPrimary: true,
    },
    {
      athleteId: `${ORG1_ID}-ath-8`,
      userId: org1Parent5.id,
      relationship: "Parent",
      isPrimary: true,
    },
  ];
  for (const g of guardianData) {
    await prisma.athleteGuardian.upsert({
      where: { athleteId_userId: { athleteId: g.athleteId, userId: g.userId } },
      update: {},
      create: g,
    });
  }
  console.log(`  ✓ Created ${guardianData.length} athlete-guardian relationships`);

  // ============================================
  // PAYMENT METHODS
  // ============================================
  console.log("\n💳 Creating payment methods...");
  const paymentMethodData = [
    {
      id: `${ORG1_ID}-pm-1`,
      userId: org1Parent1.id,
      type: "CARD" as const,
      last4: "4242",
      expiry: "12/27",
      brand: "Visa",
      isDefault: true,
    },
    {
      id: `${ORG1_ID}-pm-2`,
      userId: org1Parent2.id,
      type: "CARD" as const,
      last4: "5555",
      expiry: "08/26",
      brand: "Mastercard",
      isDefault: true,
    },
    {
      id: `${ORG1_ID}-pm-3`,
      userId: org1Parent3.id,
      type: "BANK" as const,
      last4: "6789",
      expiry: null,
      brand: null,
      isDefault: true,
    },
    {
      id: `${ORG1_ID}-pm-4`,
      userId: org1Parent4.id,
      type: "CARD" as const,
      last4: "1234",
      expiry: "03/28",
      brand: "Amex",
      isDefault: true,
    },
  ];
  for (const pm of paymentMethodData) {
    await prisma.paymentMethod.upsert({ where: { id: pm.id }, update: {}, create: pm });
  }
  console.log(`  ✓ Created ${paymentMethodData.length} payment methods`);

  // ============================================
  // LEVELS
  // ============================================
  console.log("\n🏅 Creating levels...");
  const levelData = [
    // Org1 Levels (Figure Skating)
    {
      id: `${ORG1_ID}-level-preschool`,
      organizationId: ORG1_ID,
      name: "Preschool",
      description: "Ages 2-4, parent-child classes",
      order: 0,
      color: "#f472b6",
      isDefault: false,
    },
    {
      id: `${ORG1_ID}-level-bronze`,
      organizationId: ORG1_ID,
      name: "Bronze",
      description: "Beginner recreational level",
      order: 1,
      color: "#cd7f32",
      isDefault: true,
    },
    {
      id: `${ORG1_ID}-level-silver`,
      organizationId: ORG1_ID,
      name: "Silver",
      description: "Intermediate recreational level",
      order: 2,
      color: "#c0c0c0",
      isDefault: false,
    },
    {
      id: `${ORG1_ID}-level-gold`,
      organizationId: ORG1_ID,
      name: "Gold",
      description: "Advanced recreational level",
      order: 3,
      color: "#ffd700",
      isDefault: false,
    },
    {
      id: `${ORG1_ID}-level-competitive`,
      organizationId: ORG1_ID,
      name: "Competitive",
      description: "Competition track athletes",
      order: 4,
      color: "#8b5cf6",
      isDefault: false,
    },
  ];
  for (const level of levelData) {
    await prisma.level.upsert({ where: { id: level.id }, update: {}, create: level });
  }
  console.log(`  ✓ Created ${levelData.length} levels`);

  // ============================================
  // CATEGORIES
  // ============================================
  console.log("\n🏷️ Creating categories...");
  await Promise.all([
    prisma.category.upsert({
      where: { id: `${ORG1_ID}-cat-recreational` },
      update: {},
      create: {
        id: `${ORG1_ID}-cat-recreational`,
        name: "Learn to Skate",
        description: "Fun, fitness-focused programs for all ages and skill levels",
        organizationId: ORG1_ID,
      },
    }),
    prisma.category.upsert({
      where: { id: `${ORG1_ID}-cat-competitive` },
      update: {},
      create: {
        id: `${ORG1_ID}-cat-competitive`,
        name: "Competitive Team",
        description: "Structured training programs for competitive athletes",
        organizationId: ORG1_ID,
      },
    }),
    prisma.category.upsert({
      where: { id: `${ORG1_ID}-cat-camps` },
      update: {},
      create: {
        id: `${ORG1_ID}-cat-camps`,
        name: "Camps & Clinics",
        description: "Short-term intensive programs and seasonal camps",
        organizationId: ORG1_ID,
      },
    }),
    prisma.category.upsert({
      where: { id: `${ORG1_ID}-cat-preschool` },
      update: {},
      create: {
        id: `${ORG1_ID}-cat-preschool`,
        name: "Preschool & Toddler",
        description: "Age-appropriate movement classes for our youngest athletes",
        organizationId: ORG1_ID,
      },
    }),
  ]);

  // ============================================
  // PROGRAMS
  // ============================================
  console.log("\n📚 Creating programs...");
  await Promise.all([
    // Recurring program with all-instance registration (traditional subscription)
    prisma.program.upsert({
      where: { id: `${ORG1_ID}-prog-rec-bronze` },
      update: {},
      create: {
        id: `${ORG1_ID}-prog-rec-bronze`,
        name: "Learn to Skate Bronze",
        description: "Introduction to figure skating for beginners ages 5-7",
        status: "ACTIVE",
        registrationStatus: "OPEN",
        organizationId: ORG1_ID,
        color: "#cd7f32",
        categoryId: `${ORG1_ID}-cat-recreational`,
        pricingModel: "FLAT_RATE",
        basePrice: 85,
        showCoachOnSite: true,
        startDate: daysAgo(30),
        endDate: daysFromNow(335),
        registrationType: "ALL_INSTANCES",
        startTime: "16:00",
        duration: 60,
        facilityId: `${ORG1_ID}-facility-main`,
        rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
        // Availability restrictions
        hasAgeRestriction: true,
        minAge: 5,
        maxAge: 7,
        hasLevelRestriction: true,
        hasCapacityRestriction: false,
        hasMembershipRestriction: false,
      },
    }),
    prisma.program.upsert({
      where: { id: `${ORG1_ID}-prog-rec-silver` },
      update: {},
      create: {
        id: `${ORG1_ID}-prog-rec-silver`,
        name: "Learn to Skate Silver",
        description: "Intermediate recreational program for ages 7-10",
        status: "ACTIVE",
        registrationStatus: "OPEN",
        organizationId: ORG1_ID,
        color: "#64748b",
        categoryId: `${ORG1_ID}-cat-recreational`,
        pricingModel: "FLAT_RATE",
        basePrice: 115,
        showCoachOnSite: true,
        startDate: daysAgo(30),
        endDate: daysFromNow(335),
        registrationType: "ALL_INSTANCES",
        startTime: "17:00",
        duration: 75,
        facilityId: `${ORG1_ID}-facility-main`,
        rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
        // Availability restrictions: requires Bronze level, ages 7-10
        hasAgeRestriction: true,
        minAge: 7,
        maxAge: 10,
        hasLevelRestriction: true,
        hasCapacityRestriction: false,
        hasMembershipRestriction: false,
      },
    }),
    prisma.program.upsert({
      where: { id: `${ORG1_ID}-prog-rec-gold` },
      update: {},
      create: {
        id: `${ORG1_ID}-prog-rec-gold`,
        name: "Learn to Skate Gold",
        description: "Advanced recreational program for ages 10+",
        status: "ACTIVE",
        registrationStatus: "OPEN",
        organizationId: ORG1_ID,
        color: "#f59e0b",
        categoryId: `${ORG1_ID}-cat-recreational`,
        pricingModel: "FLAT_RATE",
        basePrice: 145,
        showCoachOnSite: true,
        startDate: daysAgo(30),
        endDate: daysFromNow(335),
        registrationType: "ALL_INSTANCES",
        startTime: "18:30",
        duration: 90,
        facilityId: `${ORG1_ID}-facility-main`,
        rrule: "FREQ=WEEKLY;BYDAY=TU,TH,SA",
      },
    }),
    prisma.program.upsert({
      where: { id: `${ORG1_ID}-prog-jo` },
      update: {},
      create: {
        id: `${ORG1_ID}-prog-jo`,
        name: "STARSkate Competitive Team",
        description: "Competitive figure skating program - Pre-Juvenile through Senior",
        status: "ACTIVE",
        registrationStatus: "OPEN",
        organizationId: ORG1_ID,
        color: "#8b5cf6",
        categoryId: `${ORG1_ID}-cat-competitive`,
        pricingModel: "FLAT_RATE",
        basePrice: 2400,
        showCoachOnSite: true,
        startDate: daysAgo(60),
        endDate: daysFromNow(305),
        capacity: 30,
        registrationType: "ALL_INSTANCES",
        startTime: "15:30",
        duration: 180,
        facilityId: `${ORG1_ID}-facility-main`,
        rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
        // Availability restrictions: capacity limited, requires competitive level, minimum age 6
        hasAgeRestriction: true,
        minAge: 6,
        maxAge: null,
        hasLevelRestriction: true,
        hasCapacityRestriction: true,
        hasMembershipRestriction: true,
      },
    }),
    // Drop-in program with per-instance registration
    prisma.program.upsert({
      where: { id: `${ORG1_ID}-prog-preschool` },
      update: {},
      create: {
        id: `${ORG1_ID}-prog-preschool`,
        name: "Snowplow Sam",
        description: "Parent-child Snowplow Sam classes for ages 2-4",
        status: "ACTIVE",
        registrationStatus: "OPEN",
        organizationId: ORG1_ID,
        color: "#ec4899",
        categoryId: `${ORG1_ID}-cat-preschool`,
        pricingModel: "PER_SESSION",
        perSessionPrice: 25,
        showCoachOnSite: false,
        capacity: 12,
        startDate: daysAgo(7),
        endDate: daysFromNow(90),
        registrationType: "PER_INSTANCE",
        startTime: "09:30",
        duration: 45,
        facilityId: `${ORG1_ID}-facility-satellite`,
        rrule: "FREQ=WEEKLY;BYDAY=SA",
      },
    }),
  ]);
  console.log("  ✓ Created 5 base programs");

  // ============================================
  // PROGRAM INSTANCES
  // ============================================
  console.log("\n📅 Creating program instances...");

  // Helper function to generate weekly dates
  const generateWeeklyDates = (startDate: Date, endDate: Date, weekdays: number[]): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      if (weekdays.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Helper to calculate end time
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  };

  // Generate instances for select programs
  const programInstanceData: Array<{
    id: string;
    programId: string;
    organizationId: string;
    date: Date;
    startTime: string;
    endTime: string;
    facilityId: string | null;
    capacity: number | null;
    status: string;
  }> = [];

  // Recreational Bronze - Tuesday/Thursday 4:00 PM, 60 min
  const bronzeDates = generateWeeklyDates(daysAgo(30), daysFromNow(60), [2, 4]); // Tue, Thu
  bronzeDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG1_ID}-prog-rec-bronze-inst-${i}`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      organizationId: ORG1_ID,
      date,
      startTime: "16:00",
      endTime: calculateEndTime("16:00", 60),
      facilityId: `${ORG1_ID}-facility-main`,
      capacity: null,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Snowplow Sam - Saturday 9:30 AM (per-instance drop-in)
  const tinyTumblersDates = generateWeeklyDates(daysAgo(7), daysFromNow(60), [6]); // Saturday
  tinyTumblersDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG1_ID}-prog-preschool-inst-${i}`,
      programId: `${ORG1_ID}-prog-preschool`,
      organizationId: ORG1_ID,
      date,
      startTime: "09:30",
      endTime: calculateEndTime("09:30", 45),
      facilityId: `${ORG1_ID}-facility-satellite`,
      capacity: 12,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Create all instances (using createMany for efficiency, but handling potential duplicates)
  let instancesCreated = 0;
  for (const instance of programInstanceData) {
    try {
      await prisma.programInstance.upsert({
        where: { id: instance.id },
        update: {},
        create: instance as any,
      });
      instancesCreated++;
    } catch (e) {
      // Skip duplicates silently
    }
  }
  console.log(`  ✓ Created ${instancesCreated} program instances`);

  // Add sample instance registrations for drop-in programs
  console.log("  📝 Creating sample instance registrations...");

  // Get upcoming Snowplow Sam and Kids Fitness instances
  const upcomingTinyTumblers = programInstanceData
    .filter((i) => i.programId === `${ORG1_ID}-prog-preschool` && i.status === "SCHEDULED")
    .slice(0, 3);

  const org1ParentIds = [
    org1Parent1.id,
    org1Parent1.id,
    org1Parent2.id,
    org1Parent3.id,
    org1Parent3.id,
    org1Parent4.id,
    org1Parent5.id,
    org1Parent5.id,
  ];
  const instanceRegistrations: Array<{
    id: string;
    programInstanceId: string;
    athleteId: string;
    userId: string | null;
    status: string;
  }> = [];

  // Add registrations for Snowplow Sam
  upcomingTinyTumblers.forEach((instance, idx) => {
    // 3-5 athletes per session
    const numAthletes = 3 + (idx % 3);
    for (let a = 0; a < numAthletes; a++) {
      const athleteIndex = a + 1;
      instanceRegistrations.push({
        id: `${instance.id}-reg-${a}`,
        programInstanceId: instance.id,
        athleteId: `${ORG1_ID}-ath-${athleteIndex}`,
        userId: org1ParentIds[athleteIndex - 1] ?? org1Parent1.id,
        status: "REGISTERED",
      });
    }
  });

  let regsCreated = 0;
  for (const reg of instanceRegistrations) {
    try {
      await prisma.instanceRegistration.upsert({
        where: { id: reg.id },
        update: {},
        create: reg as any,
      });
      regsCreated++;
    } catch (e) {
      // Skip if athlete/user doesn't exist or duplicates
    }
  }
  console.log(`  ✓ Created ${regsCreated} instance registrations`);

  await Promise.all(
    [ORG1_ID, ORG_DEMO_ID].map((orgId) =>
      prisma.cacheVersion.upsert({
        where: { organizationId_entityType: { organizationId: orgId, entityType: "programs" } },
        update: { version: { increment: 1 } },
        create: { organizationId: orgId, entityType: "programs", version: 1 },
      })
    )
  );
  console.log("  ✓ Bumped program cache versions");

  // ============================================
  // PROGRAM LEVEL REQUIREMENTS (many-to-many)
  // ============================================
  console.log("\n📊 Creating program level requirements...");
  try {
    // Silver program requires Bronze level
    await prisma.programLevelRequirement.upsert({
      where: {
        programId_levelId: {
          programId: `${ORG1_ID}-prog-rec-silver`,
          levelId: `${ORG1_ID}-level-bronze`,
        },
      },
      update: {},
      create: {
        id: `${ORG1_ID}-levelreq-silver-bronze`,
        programId: `${ORG1_ID}-prog-rec-silver`,
        levelId: `${ORG1_ID}-level-bronze`,
      },
    });
    // STARSkate Team requires multiple levels (any of Gold, Platinum, or Competitive)
    await Promise.all([
      prisma.programLevelRequirement.upsert({
        where: {
          programId_levelId: { programId: `${ORG1_ID}-prog-jo`, levelId: `${ORG1_ID}-level-gold` },
        },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-gold`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-gold`,
        },
      }),
      prisma.programLevelRequirement.upsert({
        where: {
          programId_levelId: {
            programId: `${ORG1_ID}-prog-jo`,
            levelId: `${ORG1_ID}-level-platinum`,
          },
        },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-platinum`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-platinum`,
        },
      }),
      prisma.programLevelRequirement.upsert({
        where: {
          programId_levelId: {
            programId: `${ORG1_ID}-prog-jo`,
            levelId: `${ORG1_ID}-level-competitive`,
          },
        },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-competitive`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-competitive`,
        },
      }),
    ]);
    console.log("  ✓ Created 4 program level requirements");
  } catch (e) {
    console.log("  ⚠ Skipped program level requirements (missing dependencies)");
  }

  // ============================================
  // PROGRAM BULK DISCOUNTS
  // ============================================
  console.log("\n💰 Creating bulk discounts...");
  const bulkDiscountData = [
    // Org1 sibling discounts
    {
      id: `${ORG1_ID}-discount-1`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      type: "FAMILY_SIBLING" as const,
      minQuantity: 2,
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      description: "2nd child 10% off",
    },
    {
      id: `${ORG1_ID}-discount-2`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      type: "FAMILY_SIBLING" as const,
      minQuantity: 3,
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      description: "3rd child 15% off",
    },
    {
      id: `${ORG1_ID}-discount-3`,
      programId: `${ORG1_ID}-prog-rec-silver`,
      type: "FAMILY_SIBLING" as const,
      minQuantity: 2,
      discountType: "PERCENTAGE" as const,
      discountValue: 10,
      description: "Sibling discount",
    },
    {
      id: `${ORG1_ID}-discount-4`,
      programId: `${ORG1_ID}-prog-preschool`,
      type: "MULTI_SESSION" as const,
      minQuantity: 10,
      discountType: "PERCENTAGE" as const,
      discountValue: 15,
      description: "10-class pack 15% off",
    },
  ];
  for (const discount of bulkDiscountData) {
    await prisma.programBulkDiscount.upsert({
      where: { id: discount.id },
      update: {},
      create: discount,
    });
  }
  console.log(`  ✓ Created ${bulkDiscountData.length} bulk discounts`);

  // ============================================
  // MEMBERSHIP GROUPS & INSTANCES
  // ============================================
  console.log("\n📋 Creating membership groups and instances...");
  // Org1: Recurring annual membership with age restriction
  const org1MembershipGroup = await prisma.membershipGroup.upsert({
    where: { id: `${ORG1_ID}-mg-annual` },
    update: {},
    create: {
      id: `${ORG1_ID}-mg-annual`,
      organizationId: ORG1_ID,
      name: "Annual Club Membership",
      description:
        "Required annual membership for all club athletes. Grants access to recreational and competitive programs.",
      isRecurring: true,
      allowAutoRenew: true,
      defaultPrice: 75,
      defaultBillingInterval: "YEARLY",
      autoGenerateInstances: true,
      generationLeadDays: 60,
      hasAgeRestriction: true,
      minAge: 5,
      maxAge: 18,
      hasCapacityRestriction: false,
    },
  });
  await Promise.all([
    prisma.membershipInstance.upsert({
      where: { id: `${ORG1_ID}-mi-2026` },
      update: {},
      create: {
        id: `${ORG1_ID}-mi-2026`,
        membershipGroupId: org1MembershipGroup.id,
        name: "2025-2026 Season",
        price: 75,
        billingInterval: "YEARLY",
        startDate: noonUTC("2025-09-01"),
        endDate: noonUTC("2026-08-31"),
        autoRenewDate: noonUTC("2026-07-01"),
        status: "ACTIVE",
        isAutoGenerated: false,
      },
    }),
  ]);
  console.log("  ✓ Created 1 membership group and 1 instance");

  // ============================================
  // ATHLETE MEMBERSHIPS
  // ============================================
  console.log("\n🎟️ Creating athlete memberships...");
  const athleteMembershipData = [
    {
      id: `${ORG1_ID}-am-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      membershipInstanceId: `${ORG1_ID}-mi-2026`,
      startDate: noonUTC("2025-09-01"),
      status: "ACTIVE" as const,
      autoRenew: true,
    },
    {
      id: `${ORG1_ID}-am-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      membershipInstanceId: `${ORG1_ID}-mi-2026`,
      startDate: noonUTC("2025-09-01"),
      status: "ACTIVE" as const,
      autoRenew: true,
    },
    {
      id: `${ORG1_ID}-am-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      membershipInstanceId: `${ORG1_ID}-mi-2026`,
      startDate: noonUTC("2025-09-01"),
      status: "ACTIVE" as const,
      autoRenew: false,
    },
    {
      id: `${ORG1_ID}-am-4`,
      athleteId: `${ORG1_ID}-ath-4`,
      membershipInstanceId: `${ORG1_ID}-mi-2026`,
      startDate: noonUTC("2025-09-15"),
      status: "ACTIVE" as const,
      autoRenew: true,
    },
  ];
  for (const am of athleteMembershipData) {
    await prisma.athleteMembership.upsert({ where: { id: am.id }, update: {}, create: am });
  }
  console.log(`  ✓ Created ${athleteMembershipData.length} athlete memberships`);

  // ============================================
  // ENROLLMENTS
  // ============================================
  console.log("\n📝 Creating enrollments...");
  const enrollmentData = [
    {
      id: `${ORG1_ID}-enr-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      userId: org1Parent1.id,
      startDate: daysAgo(60),
      status: "ACTIVE" as const,
    },
    {
      id: `${ORG1_ID}-enr-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      programId: `${ORG1_ID}-prog-rec-silver`,
      userId: org1Parent1.id,
      startDate: daysAgo(60),
      status: "ACTIVE" as const,
    },
    {
      id: `${ORG1_ID}-enr-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      programId: `${ORG1_ID}-prog-jo`,
      userId: org1Parent2.id,
      startDate: daysAgo(120),
      status: "ACTIVE" as const,
    },
    {
      id: `${ORG1_ID}-enr-4`,
      athleteId: `${ORG1_ID}-ath-4`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      userId: org1Parent3.id,
      startDate: daysAgo(30),
      status: "ACTIVE" as const,
    },
  ];
  for (const enr of enrollmentData) {
    await prisma.enrollment.upsert({ where: { id: enr.id }, update: {}, create: enr });
  }
  console.log(`  ✓ Created ${enrollmentData.length} enrollments`);

  // ============================================
  // EVENTS
  // ============================================
  console.log("\n📅 Creating events...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await Promise.all([
    prisma.event.upsert({
      where: { id: `${ORG1_ID}-evt-1` },
      update: {},
      create: {
        id: `${ORG1_ID}-evt-1`,
        title: "Bronze Class - Monday",
        color: "#cd7f32",
        date: today,
        startTime: "16:00",
        endTime: "17:00",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-rec-bronze`,
        coachId: org1Coach1.id,
        organizationId: ORG1_ID,
        capacity: 12,
      },
    }),
    prisma.event.upsert({
      where: { id: `${ORG1_ID}-evt-2` },
      update: {},
      create: {
        id: `${ORG1_ID}-evt-2`,
        title: "Silver Class - Monday",
        color: "#64748b",
        date: today,
        startTime: "17:00",
        endTime: "18:30",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-rec-silver`,
        coachId: org1Coach1.id,
        organizationId: ORG1_ID,
        capacity: 10,
      },
    }),
    prisma.event.upsert({
      where: { id: `${ORG1_ID}-evt-3` },
      update: {},
      create: {
        id: `${ORG1_ID}-evt-3`,
        title: "STARSkate Team Practice",
        color: "#8b5cf6",
        date: today,
        startTime: "18:30",
        endTime: "21:00",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-jo`,
        coachId: org1Coach2.id,
        organizationId: ORG1_ID,
        capacity: 20,
      },
    }),
    prisma.event.upsert({
      where: { id: `${ORG1_ID}-evt-4` },
      update: {},
      create: {
        id: `${ORG1_ID}-evt-4`,
        title: "STARSkate Team Tryouts",
        color: "#d946ef",
        date: daysFromNow(45),
        startTime: "08:00",
        endTime: "12:00",
        type: "TRYOUT",
        description: "Open tryouts for the JO competitive team",
        programId: `${ORG1_ID}-prog-jo`,
        organizationId: ORG1_ID,
        capacity: 100,
      },
    }),
    prisma.event.upsert({
      where: { id: `${ORG1_ID}-evt-5` },
      update: {},
      create: {
        id: `${ORG1_ID}-evt-5`,
        title: "Tumbling Skills Clinic",
        color: "#14b8a6",
        date: daysFromNow(30),
        startTime: "09:00",
        endTime: "12:00",
        type: "CLINIC",
        description: "One-day tumbling and floor skills clinic",
        organizationId: ORG1_ID,
        capacity: 40,
        categoryId: `${ORG1_ID}-cat-camps`,
      },
    }),
  ]);
  console.log("  ✓ Created 5 events");

  // ============================================
  // HISTORICAL EVENTS (for attendance metrics)
  // ============================================
  console.log("\n📆 Creating historical events for attendance tracking...");
  const historicalEvents: Array<{
    id: string;
    title: string;
    date: Date;
    startTime: string;
    endTime: string;
    type: "CLASS" | "CLINIC" | "PARTY" | "TRYOUT" | "MEETING" | "OTHER";
    programId: string;
    coachId: string;
    organizationId: string;
    capacity: number;
  }> = [];

  // Create 4 weeks of historical events for ORG1
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    historicalEvents.push(
      {
        id: `${ORG1_ID}-evt-hist-bronze-${week}`,
        title: "Bronze Class - Historical",
        date: weekDate,
        startTime: "16:00",
        endTime: "17:00",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-rec-bronze`,
        coachId: org1Coach1.id,
        organizationId: ORG1_ID,
        capacity: 12,
      },
      {
        id: `${ORG1_ID}-evt-hist-silver-${week}`,
        title: "Silver Class - Historical",
        date: weekDate,
        startTime: "17:00",
        endTime: "18:30",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-rec-silver`,
        coachId: org1Coach1.id,
        organizationId: ORG1_ID,
        capacity: 10,
      },
      {
        id: `${ORG1_ID}-evt-hist-jo-${week}`,
        title: "STARSkate Team Practice - Historical",
        date: weekDate,
        startTime: "18:30",
        endTime: "21:00",
        type: "CLASS",
        programId: `${ORG1_ID}-prog-jo`,
        coachId: org1Coach2.id,
        organizationId: ORG1_ID,
        capacity: 20,
      }
    );
  }

  for (const evt of historicalEvents) {
    await prisma.event.upsert({ where: { id: evt.id }, update: {}, create: evt });
  }
  console.log(`  ✓ Created ${historicalEvents.length} historical events`);

  // ============================================
  // ATTENDANCE
  // ============================================
  console.log("\n✅ Creating comprehensive attendance records...");
  const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
  const attendanceData: Array<{
    athleteId: string;
    eventId: string;
    status: (typeof attendanceStatuses)[number] | "REGISTERED";
    checkedIn?: Date;
    notes?: string;
  }> = [];

  // Today's events attendance
  attendanceData.push(
    {
      athleteId: `${ORG1_ID}-ath-1`,
      eventId: `${ORG1_ID}-evt-1`,
      status: "PRESENT",
      checkedIn: today,
    },
    {
      athleteId: `${ORG1_ID}-ath-4`,
      eventId: `${ORG1_ID}-evt-1`,
      status: "PRESENT",
      checkedIn: today,
    },
    {
      athleteId: `${ORG1_ID}-ath-2`,
      eventId: `${ORG1_ID}-evt-2`,
      status: "PRESENT",
      checkedIn: today,
    },
    {
      athleteId: `${ORG1_ID}-ath-3`,
      eventId: `${ORG1_ID}-evt-3`,
      status: "PRESENT",
      checkedIn: today,
    },
    { athleteId: `${ORG1_ID}-ath-3`, eventId: `${ORG1_ID}-evt-4`, status: "REGISTERED" }
  );

  // Historical attendance - ORG1 (Bronze class - Athlete 1 and 4)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    // Athlete 1 - good attendance (mostly present, occasional late)
    const ath1Status = week === 2 ? "LATE" : week === 4 ? "EXCUSED" : "PRESENT";
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-1`,
      eventId: `${ORG1_ID}-evt-hist-bronze-${week}`,
      status: ath1Status,
      checkedIn: ath1Status !== "EXCUSED" ? weekDate : undefined,
      notes: ath1Status === "EXCUSED" ? "Family vacation" : undefined,
    });

    // Athlete 4 - some absences
    const ath4Status = week === 1 ? "ABSENT" : week === 3 ? "LATE" : "PRESENT";
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-4`,
      eventId: `${ORG1_ID}-evt-hist-bronze-${week}`,
      status: ath4Status,
      checkedIn: ath4Status === "PRESENT" || ath4Status === "LATE" ? weekDate : undefined,
      notes: ath4Status === "ABSENT" ? "Sick" : undefined,
    });
  }

  // Historical attendance - ORG1 (Silver class - Athlete 2)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 3 ? "ABSENT" : "PRESENT";
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-2`,
      eventId: `${ORG1_ID}-evt-hist-silver-${week}`,
      status,
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "ABSENT" ? "School event" : undefined,
    });
  }

  // Historical attendance - ORG1 (STARSkate Team - Athlete 3) - Perfect attendance
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-3`,
      eventId: `${ORG1_ID}-evt-hist-jo-${week}`,
      status: "PRESENT",
      checkedIn: weekDate,
    });
  }

  // Historical attendance - ORG1 (Silver class - Athlete 7, Ava, trial)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week <= 2 ? "PRESENT" : "ABSENT";
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-7`,
      eventId: `${ORG1_ID}-evt-hist-silver-${week}`,
      status,
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "ABSENT" ? "Trial period ended" : undefined,
    });
  }

  // Historical attendance - ORG1 (STARSkate Team - Athlete 5, Mia, Gold level)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 2 ? "LATE" : "PRESENT";
    attendanceData.push({
      athleteId: `${ORG1_ID}-ath-5`,
      eventId: `${ORG1_ID}-evt-hist-jo-${week}`,
      status,
      checkedIn: weekDate,
      notes: status === "LATE" ? "Arrived 10 minutes late" : undefined,
    });
  }

  for (const att of attendanceData) {
    await prisma.attendance.upsert({
      where: { athleteId_eventId: { athleteId: att.athleteId, eventId: att.eventId } },
      update: {},
      create: att,
    });
  }
  console.log(
    `  ✓ Created ${attendanceData.length} attendance records (including ${attendanceData.length - 8} historical records)`
  );

  // ============================================
  // INVOICES & LINE ITEMS
  // ============================================
  console.log("\n🧾 Creating invoices...");
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-1` },
    update: {},
    create: {
      id: `${ORG1_ID}-inv-1`,
      reference: "SGA-2026-0001",
      userId: org1Parent1.id,
      status: "PAID",
      dueDate: daysAgo(15),
      subtotal: 200,
      tax: 18,
      total: 218,
      notes: "January tuition",
      organizationId: ORG1_ID,
      lineItems: {
        create: [
          {
            description: "Bronze Monthly - Emily",
            quantity: 1,
            unitPrice: 85,
            total: 85,
            programId: `${ORG1_ID}-prog-rec-bronze`,
            athleteId: `${ORG1_ID}-ath-1`,
          },
          {
            description: "Silver Monthly - Sophie",
            quantity: 1,
            unitPrice: 115,
            total: 115,
            programId: `${ORG1_ID}-prog-rec-silver`,
            athleteId: `${ORG1_ID}-ath-2`,
          },
        ],
      },
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-2` },
    update: {},
    create: {
      id: `${ORG1_ID}-inv-2`,
      reference: "SGA-2026-0002",
      userId: org1Parent2.id,
      status: "SENT",
      dueDate: daysFromNow(15),
      subtotal: 200,
      tax: 18,
      total: 218,
      organizationId: ORG1_ID,
      lineItems: {
        create: [
          {
            description: "STARSkate Team Monthly - Olivia",
            quantity: 1,
            unitPrice: 200,
            total: 200,
            programId: `${ORG1_ID}-prog-jo`,
            athleteId: `${ORG1_ID}-ath-3`,
          },
        ],
      },
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-3` },
    update: {},
    create: {
      id: `${ORG1_ID}-inv-3`,
      reference: "SGA-2026-0003",
      userId: org1Parent3.id,
      status: "OVERDUE",
      dueDate: daysAgo(10),
      subtotal: 85,
      tax: 7.65,
      total: 92.65,
      organizationId: ORG1_ID,
      lineItems: {
        create: [
          {
            description: "Bronze Monthly - Lily",
            quantity: 1,
            unitPrice: 85,
            total: 85,
            programId: `${ORG1_ID}-prog-rec-bronze`,
            athleteId: `${ORG1_ID}-ath-4`,
          },
        ],
      },
    },
  });
  console.log("  ✓ Created 3 invoices with line items");

  // ============================================
  // PAYMENTS
  // ============================================
  console.log("\n💰 Creating payments...");
  const paymentData = [
    {
      id: `${ORG1_ID}-pay-1`,
      invoiceId: `${ORG1_ID}-inv-1`,
      userId: org1Parent1.id,
      amount: 218,
      method: "CARD" as const,
      status: "COMPLETED" as const,
      processedAt: daysAgo(20),
    },
  ];
  for (const pay of paymentData) {
    await prisma.payment.upsert({ where: { id: pay.id }, update: {}, create: pay });
  }
  console.log(`  ✓ Created ${paymentData.length} payments`);

  // ============================================
  // DISCOUNTS
  // ============================================
  console.log("\n🏷️ Creating discounts...");
  const discountData = [
    {
      id: `${ORG1_ID}-disc-1`,
      name: "New Member Welcome",
      code: "WELCOME15",
      type: "PERCENTAGE" as const,
      amount: 15,
      validFrom: daysAgo(90),
      validTo: daysFromNow(90),
      userScope: "NEW_USERS" as const,
      productScope: "ALL" as const,
      status: "ACTIVE" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-disc-2`,
      name: "Sibling Discount",
      code: "SIBLING10",
      type: "PERCENTAGE" as const,
      amount: 10,
      validFrom: daysAgo(365),
      userScope: "MEMBERS" as const,
      productScope: "MEMBERSHIP" as const,
      status: "ACTIVE" as const,
      organizationId: ORG1_ID,
    },
  ];
  for (const disc of discountData) {
    await prisma.discount.upsert({ where: { id: disc.id }, update: {}, create: disc });
  }
  console.log(`  ✓ Created ${discountData.length} discounts`);

  // ============================================
  // GL CODES
  // ============================================
  console.log("\n📊 Creating GL codes...");
  const glCodeData = [
    // Org1 defaults
    {
      id: `${ORG1_ID}-gl-def-prog`,
      code: "4100",
      description: "Program Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "PROGRAM" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-event`,
      code: "4200",
      description: "Event Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "EVENT" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-comp`,
      code: "4300",
      description: "Competition Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "COMPETITION" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-memb`,
      code: "4400",
      description: "Membership Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "MEMBERSHIP" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-pass`,
      code: "4500",
      description: "Pass Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "PASS" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-prod`,
      code: "4600",
      description: "Product Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      defaultForType: "PRODUCT" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-def-tax`,
      code: "2100",
      description: "Sales Tax Collected",
      type: "LIABILITY" as const,
      status: "ACTIVE" as const,
      isDefault: true,
      organizationId: ORG1_ID,
    },
    // Org1 custom codes
    {
      id: `${ORG1_ID}-gl-1`,
      code: "SGA-4100",
      description: "Tuition Revenue",
      type: "REVENUE" as const,
      status: "ACTIVE" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-2`,
      code: "SGA-5100",
      description: "Coach Salaries",
      type: "EXPENSE" as const,
      status: "ACTIVE" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-gl-3`,
      code: "SGA-5200",
      description: "Equipment",
      type: "EXPENSE" as const,
      status: "ACTIVE" as const,
      organizationId: ORG1_ID,
    },
  ];
  for (const gl of glCodeData) {
    await prisma.gLCode.upsert({
      where: { id: gl.id },
      update: { code: gl.code, description: gl.description, type: gl.type, status: gl.status },
      create: gl,
    });
  }
  console.log(`  ✓ Created ${glCodeData.length} GL codes`);

  // ============================================
  // LEDGER ENTRIES
  // ============================================
  console.log("\n📒 Creating ledger entries...");
  const ledgerData = [
    {
      id: `${ORG1_ID}-le-1`,
      date: daysAgo(20),
      description: "Michelle Anderson - January tuition",
      glCodeId: `${ORG1_ID}-gl-1`,
      reference: "SGA-2026-0001",
      credit: 218,
      status: "POSTED" as const,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-le-2`,
      date: daysAgo(15),
      description: "Monthly coach salary",
      glCodeId: `${ORG1_ID}-gl-2`,
      debit: 3500,
      status: "POSTED" as const,
      organizationId: ORG1_ID,
    },
  ];
  for (const le of ledgerData) {
    await prisma.ledgerEntry.upsert({ where: { id: le.id }, update: {}, create: le });
  }
  console.log(`  ✓ Created ${ledgerData.length} ledger entries`);

  // ============================================
  // SKILLS (Enhanced with difficulty levels and age ranges)
  // ============================================
  console.log("\n🎯 Creating skills...");

  // Org1 - Figure skating skills organized by category and difficulty
  const org1SkillsData = [
    // Edges - Beginner (ages 4-8)
    {
      id: `${ORG1_ID}-skill-1`,
      name: "Forward Swizzles",
      category: "Edges",
      minAge: 4,
      maxAge: 8,
      description:
        "Two-foot forward swizzles in a continuous pattern. Key points: knees bend, push out and in with both feet, blades stay on the ice.",
    },
    {
      id: `${ORG1_ID}-skill-2`,
      name: "Backward Swizzles",
      category: "Edges",
      minAge: 4,
      maxAge: 8,
      description:
        "Two-foot backward swizzles maintaining momentum. Key points: weight over balls of feet, push out and in evenly, look over shoulder.",
    },
    {
      id: `${ORG1_ID}-skill-3`,
      name: "One-Foot Glide",
      category: "Edges",
      minAge: 5,
      maxAge: 10,
      description:
        "Glide on one foot in a straight line, free leg extended. Key points: bent skating knee, hips square, free leg pointed.",
    },
    {
      id: `${ORG1_ID}-skill-4`,
      name: "Snowplow Stop",
      category: "Edges",
      minAge: 5,
      maxAge: 10,
      description:
        "Controlled stop by pushing both feet outward into a snowplow shape. Key points: bent knees, blades scrape, shoulders square.",
    },
    {
      id: `${ORG1_ID}-skill-5`,
      name: "Forward Stroking",
      category: "Edges",
      minAge: 4,
      maxAge: 8,
      description:
        "Continuous forward stroking with full extension on each push. Key points: full knee bend, pointed free leg, alternating arms.",
    },

    // Footwork - Intermediate (ages 6-12)
    {
      id: `${ORG1_ID}-skill-6`,
      name: "Forward Crossovers",
      category: "Footwork",
      minAge: 6,
      maxAge: 12,
      description:
        "Forward crossovers in a circle, alternating left and right. Key points: cross over (not behind), bent knees, edges throughout.",
    },
    {
      id: `${ORG1_ID}-skill-7`,
      name: "Backward Stroking",
      category: "Footwork",
      minAge: 6,
      maxAge: 12,
      description:
        "Continuous backward stroking with control. Key points: weight over balls of feet, push from inside edge, look over shoulder.",
    },
    {
      id: `${ORG1_ID}-skill-8`,
      name: "Backward Crossovers",
      category: "Footwork",
      minAge: 6,
      maxAge: 12,
      description:
        "Backward crossovers in a circle. Key points: cross over in front, bent knees, controlled edges, eyes on direction of travel.",
    },

    // Jumps - Advanced (ages 8+)
    {
      id: `${ORG1_ID}-skill-9`,
      name: "Waltz Jump",
      category: "Jumps",
      minAge: 8,
      maxAge: 18,
      description:
        "Half-rotation jump from a forward outside edge to a backward outside edge. Key points: knee bend on takeoff, free leg swing through, check on landing.",
    },
    {
      id: `${ORG1_ID}-skill-10`,
      name: "Salchow Jump",
      category: "Jumps",
      minAge: 8,
      maxAge: 18,
      description:
        "Single-rotation edge jump taking off from a back inside edge. Key points: deep bent knee, free leg swing, tight rotation, clean back outside edge landing.",
    },

    // Jumps - Beginner
    {
      id: `${ORG1_ID}-skill-11`,
      name: "Bunny Hop",
      category: "Jumps",
      minAge: 5,
      maxAge: 10,
      description:
        "Small forward jump from one foot to the other with a toe assist. Key points: bent knees, free leg kicks through, toe tap on landing.",
    },
    {
      id: `${ORG1_ID}-skill-12`,
      name: "Mazurka",
      category: "Jumps",
      minAge: 6,
      maxAge: 12,
      description:
        "Half-rotation toe-assisted jump in a crossed-leg position in the air. Key points: cross legs in air, point free toe, controlled landing.",
    },

    // Jumps - Intermediate/Advanced
    {
      id: `${ORG1_ID}-skill-13`,
      name: "Toe Loop",
      category: "Jumps",
      minAge: 8,
      maxAge: 18,
      description:
        "Single-rotation toe jump taking off from a back outside edge with a toe pick assist. Key points: strong toe pick, tight rotation, clean back outside edge landing.",
    },

    // Spirals - Beginner
    {
      id: `${ORG1_ID}-skill-14`,
      name: "Forward Spiral",
      category: "Spirals",
      minAge: 5,
      maxAge: 10,
      description:
        "Glide on one foot with the free leg extended behind at or above hip level. Key points: pointed free toe, lifted back, square hips.",
    },
    {
      id: `${ORG1_ID}-skill-15`,
      name: "Backward Spiral",
      category: "Spirals",
      minAge: 5,
      maxAge: 10,
      description:
        "Glide backward on one foot with the free leg extended behind. Key points: weight on ball of foot, lifted back, controlled edge.",
    },
    {
      id: `${ORG1_ID}-skill-16`,
      name: "Lunge",
      category: "Spirals",
      minAge: 5,
      maxAge: 10,
      description:
        "Deep lunge glide on one foot with free leg extended back along the ice. Key points: deep skating knee bend, straight free leg, arms extended.",
    },

    // Spirals - Intermediate
    {
      id: `${ORG1_ID}-skill-17`,
      name: "Spread Eagle",
      category: "Spirals",
      minAge: 6,
      maxAge: 14,
      description:
        "Glide on two feet pointing in opposite directions, hips and shoulders open. Key points: open hips, straight legs, even weight on both feet.",
    },
    {
      id: `${ORG1_ID}-skill-18`,
      name: "Loop Jump",
      category: "Jumps",
      minAge: 8,
      maxAge: 18,
      description:
        "Single-rotation edge jump taking off and landing on the same back outside edge. Key points: crossed legs on takeoff, tight rotation, clean landing edge.",
    },

    // Spins - Beginner
    {
      id: `${ORG1_ID}-skill-19`,
      name: "Two-Foot Spin",
      category: "Spins",
      minAge: 4,
      maxAge: 8,
      description:
        "Centered two-foot spin with multiple rotations. Key points: bent knees, weight over balls of feet, arms in tight on rotation.",
    },
    {
      id: `${ORG1_ID}-skill-20`,
      name: "One-Foot Spin",
      category: "Spins",
      minAge: 4,
      maxAge: 8,
      description:
        "Centered upright spin on one foot. Key points: tight free leg crossed, arms in, weight over ball of foot.",
    },
    {
      id: `${ORG1_ID}-skill-21`,
      name: "Three Turn",
      category: "Footwork",
      minAge: 5,
      maxAge: 10,
      description:
        "One-foot turn from forward outside edge to backward inside edge that traces a '3' on the ice. Key points: shoulder check, controlled edge, no scratch.",
    },
    {
      id: `${ORG1_ID}-skill-22`,
      name: "Sit Spin",
      category: "Spins",
      minAge: 5,
      maxAge: 10,
      description:
        "Spin in a low sitting position with thigh parallel to the ice. Key points: deep knee bend, free leg extended forward, back straight.",
    },

    // Spins - Intermediate
    {
      id: `${ORG1_ID}-skill-23`,
      name: "Camel Spin",
      category: "Spins",
      minAge: 7,
      maxAge: 14,
      description:
        "Spin in spiral position — skating leg straight, free leg extended back at hip level. Key points: parallel back and free leg, square hips, strong core.",
    },
    {
      id: `${ORG1_ID}-skill-24`,
      name: "Layback Spin",
      category: "Spins",
      minAge: 7,
      maxAge: 14,
      description:
        "Upright spin with the head and shoulders dropped back, free leg behind. Key points: controlled drop, arched back, free leg lifted, smooth entry.",
    },

    // Conditioning - General
    {
      id: `${ORG1_ID}-skill-25`,
      name: "Forward Edges",
      category: "Conditioning",
      minAge: 4,
      maxAge: 18,
      description:
        "Forward outside and inside edges traced down the rink. Key points: deep edges, controlled lean, free leg pointed.",
    },
    {
      id: `${ORG1_ID}-skill-26`,
      name: "Backward Edges",
      category: "Conditioning",
      minAge: 4,
      maxAge: 18,
      description:
        "Backward outside and inside edges down the rink. Key points: weight over ball of foot, controlled lean, look over shoulder.",
    },
    {
      id: `${ORG1_ID}-skill-27`,
      name: "Off-Ice Core Conditioning",
      category: "Conditioning",
      minAge: 5,
      maxAge: 18,
      description:
        "Plank, hollow holds, and rotational core work that supports jump rotation and spin position. Key points: tight core, neutral spine, controlled breathing.",
    },
    {
      id: `${ORG1_ID}-skill-28`,
      name: "Off-Ice Flexibility",
      category: "Conditioning",
      minAge: 5,
      maxAge: 18,
      description:
        "Hip openers, splits, and back flexibility work that supports spirals, spins, and Biellmann positions. Key points: warm up first, hold each stretch with control.",
    },
  ];

  for (const skill of org1SkillsData) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {},
      create: { ...skill, organizationId: ORG1_ID },
    });
  }

  console.log(`  ✓ Created ${org1SkillsData.length} skills`);

  // ============================================
  // EVALUATION TEMPLATES
  // ============================================
  console.log("\n📋 Creating evaluation templates...");

  const evaluationTemplatesData = [
    // Org1 - Figure skating evaluation templates
    {
      id: `${ORG1_ID}-template-preschool`,
      name: "Preschool Basics",
      description:
        "Fundamental skills assessment for preschool-aged skaters (ages 4-5). Focus on ice familiarity, basic movement, and fun!",
      levelId: `${ORG1_ID}-level-bronze`,
      minAge: 4,
      maxAge: 5,
      organizationId: ORG1_ID,
      // New evaluation enhancement fields
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [
        `${ORG1_ID}-skill-1`,
        `${ORG1_ID}-skill-3`,
        `${ORG1_ID}-skill-5`,
        `${ORG1_ID}-skill-19`,
        `${ORG1_ID}-skill-25`,
      ],
    },
    {
      id: `${ORG1_ID}-template-rec-level1`,
      name: "Recreational Level 1",
      description:
        "Entry-level recreational assessment covering edges, footwork, and basic spins (ages 5-7).",
      levelId: `${ORG1_ID}-level-bronze`,
      minAge: 5,
      maxAge: 7,
      organizationId: ORG1_ID,
      // Pass/Fail scoring with 75% completion requirement
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 75,
      skillIds: [
        `${ORG1_ID}-skill-1`,
        `${ORG1_ID}-skill-2`,
        `${ORG1_ID}-skill-3`,
        `${ORG1_ID}-skill-11`,
        `${ORG1_ID}-skill-14`,
        `${ORG1_ID}-skill-19`,
        `${ORG1_ID}-skill-20`,
        `${ORG1_ID}-skill-27`,
      ],
    },
    {
      id: `${ORG1_ID}-template-rec-level2`,
      name: "Recreational Level 2",
      description: "Intermediate recreational assessment with more challenging skills (ages 6-9).",
      levelId: `${ORG1_ID}-level-silver`,
      minAge: 6,
      maxAge: 9,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with pass threshold of 7
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [
        `${ORG1_ID}-skill-4`,
        `${ORG1_ID}-skill-6`,
        `${ORG1_ID}-skill-7`,
        `${ORG1_ID}-skill-12`,
        `${ORG1_ID}-skill-15`,
        `${ORG1_ID}-skill-17`,
        `${ORG1_ID}-skill-21`,
        `${ORG1_ID}-skill-22`,
      ],
    },
    {
      id: `${ORG1_ID}-template-preteam`,
      name: "Pre-Team Assessment",
      description:
        "Assessment to determine readiness for competitive team program (ages 7-10). Must demonstrate proficiency in intermediate skills.",
      levelId: `${ORG1_ID}-level-silver`,
      minAge: 7,
      maxAge: 10,
      organizationId: ORG1_ID,
      // All skills must pass for pre-team readiness
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "ALL" as const,
      completionThreshold: 100,
      skillIds: [
        `${ORG1_ID}-skill-6`,
        `${ORG1_ID}-skill-7`,
        `${ORG1_ID}-skill-8`,
        `${ORG1_ID}-skill-13`,
        `${ORG1_ID}-skill-17`,
        `${ORG1_ID}-skill-18`,
        `${ORG1_ID}-skill-23`,
        `${ORG1_ID}-skill-24`,
      ],
    },
    {
      id: `${ORG1_ID}-template-jo-level3`,
      name: "Pre-Juvenile Readiness",
      description:
        "Assessment for U.S. Figure Skating Pre-Juvenile competition readiness (ages 8-12). Advanced beginner skills required.",
      levelId: `${ORG1_ID}-level-gold`,
      minAge: 8,
      maxAge: 12,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with strict 8+ threshold and 90% completion
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 8,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 90,
      skillIds: [
        `${ORG1_ID}-skill-9`,
        `${ORG1_ID}-skill-10`,
        `${ORG1_ID}-skill-13`,
        `${ORG1_ID}-skill-18`,
        `${ORG1_ID}-skill-23`,
        `${ORG1_ID}-skill-24`,
      ],
    },
    {
      id: `${ORG1_ID}-template-auto-beginner`,
      name: "All Beginner Skills Assessment",
      description:
        "Auto-synced template that automatically includes all beginner-level skills. Great for comprehensive beginner evaluation.",
      levelId: `${ORG1_ID}-level-bronze`,
      minAge: 5,
      maxAge: 10,
      organizationId: ORG1_ID,
      // Auto-sync enabled - will automatically include all beginner skills
      autoSyncEnabled: true,
      autoSyncLevels: ["BEGINNER"] as string[],
      autoSyncCategories: [] as string[], // Empty means all categories
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "COUNT" as const,
      completionThreshold: 10, // Must pass at least 10 skills
      skillIds: [] as string[], // Will be populated by auto-sync
    },
  ];

  for (const template of evaluationTemplatesData) {
    const { skillIds, ...templateData } = template;

    await prisma.evaluationTemplate.upsert({
      where: { id: template.id },
      update: {
        // Update with new fields if template already exists
        autoSyncEnabled: templateData.autoSyncEnabled,
        autoSyncLevels: templateData.autoSyncLevels,
        autoSyncCategories: templateData.autoSyncCategories,
        scoringType: templateData.scoringType,
        pointScaleMin: templateData.pointScaleMin,
        pointScaleMax: templateData.pointScaleMax,
        pointScalePassThreshold: templateData.pointScalePassThreshold,
        completionType: templateData.completionType,
        completionThreshold: templateData.completionThreshold,
      },
      create: {
        ...templateData,
        skills:
          skillIds.length > 0
            ? {
                create: skillIds.map((skillId, index) => ({
                  skillId,
                  order: index,
                  isRequired: true,
                })),
              }
            : undefined,
      },
    });
  }

  console.log(`  ✓ Created ${evaluationTemplatesData.length} evaluation templates`);

  // ============================================
  // ACHIEVEMENTS
  // ============================================
  console.log("\n🏆 Creating achievements...");

  const achievementsData = [
    {
      id: `${ORG1_ID}-achievement-preschool`,
      templateId: `${ORG1_ID}-template-preschool`,
      name: "Preschool Graduate",
      description:
        "Successfully completed the Preschool Basics evaluation. Ready for the next level!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-rec-level1`,
      templateId: `${ORG1_ID}-template-rec-level1`,
      name: "Rec Level 1 Champion",
      description: "Mastered all foundational skating skills in Recreational Level 1.",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-rec-level2`,
      templateId: `${ORG1_ID}-template-rec-level2`,
      name: "Rec Level 2 Star",
      description: "Achieved excellence in intermediate recreational skating skills.",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-preteam`,
      templateId: `${ORG1_ID}-template-preteam`,
      name: "Pre-Team Ready",
      description:
        "Demonstrated readiness for the competitive team program. Outstanding dedication!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-jo-level3`,
      templateId: `${ORG1_ID}-template-jo-level3`,
      name: "Pre-Juvenile Qualifier",
      description:
        "Qualified for U.S. Figure Skating Pre-Juvenile competition. An impressive achievement!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
  ];

  for (const achievement of achievementsData) {
    await prisma.achievement.upsert({
      where: { id: achievement.id },
      update: {},
      create: achievement,
    });
  }

  console.log(`  ✓ Created ${achievementsData.length} achievements`);

  // ============================================
  // PROGRAM EVALUATION TEMPLATES (Assign templates to programs)
  // ============================================
  console.log("\n🔗 Assigning evaluation templates to programs...");

  const programTemplateAssignments = [
    // Bronze program uses Rec Level 1 template
    {
      id: `${ORG1_ID}-pet-bronze-rec1`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      templateId: `${ORG1_ID}-template-rec-level1`,
      isRequired: true,
      dueDate: null,
    },
    // Silver program uses Rec Level 2 template
    {
      id: `${ORG1_ID}-pet-silver-rec2`,
      programId: `${ORG1_ID}-prog-rec-silver`,
      templateId: `${ORG1_ID}-template-rec-level2`,
      isRequired: true,
      dueDate: null,
    },
    // Competitive program uses Pre-Team and Pre-Juvenile templates
    {
      id: `${ORG1_ID}-pet-jo-preteam`,
      programId: `${ORG1_ID}-prog-jo`,
      templateId: `${ORG1_ID}-template-preteam`,
      isRequired: false,
      dueDate: null,
    },
    {
      id: `${ORG1_ID}-pet-jo-jo3`,
      programId: `${ORG1_ID}-prog-jo`,
      templateId: `${ORG1_ID}-template-jo-level3`,
      isRequired: true,
      dueDate: null,
    },
    // Preschool program uses Preschool Basics template
    {
      id: `${ORG1_ID}-pet-preschool`,
      programId: `${ORG1_ID}-prog-preschool`,
      templateId: `${ORG1_ID}-template-preschool`,
      isRequired: true,
      dueDate: null,
    },
  ];

  for (const assignment of programTemplateAssignments) {
    await prisma.programEvaluationTemplate.upsert({
      where: {
        programId_templateId: {
          programId: assignment.programId,
          templateId: assignment.templateId,
        },
      },
      update: {},
      create: assignment,
    });
  }

  console.log(`  ✓ Created ${programTemplateAssignments.length} program-template assignments`);

  // ============================================
  // LESSON PLANS
  // ============================================
  console.log("\n📖 Creating lesson plans...");
  await prisma.lessonPlan.upsert({
    where: { id: `${ORG1_ID}-lp-1` },
    update: {},
    create: {
      id: `${ORG1_ID}-lp-1`,
      name: "Bronze Week 1 - Edge Fundamentals",
      programId: `${ORG1_ID}-prog-rec-bronze`,
      date: today,
      authorId: org1Coach1.id,
      status: "ACTIVE",
      theme: "Edge Development Week",
      organizationId: ORG1_ID,
    },
  });
  console.log("  ✓ Created 1 lesson plan");

  // ============================================
  // EVALUATIONS (Enhanced with templates and skill attempt statuses)
  // ============================================
  console.log("\n📝 Creating evaluations...");

  // Evaluation 1 - Emily (Bronze athlete) - Completed Rec Level 1
  const eval1 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-1` },
    update: { programId: `${ORG1_ID}-prog-rec-bronze` },
    create: {
      id: `${ORG1_ID}-eval-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level1`,
      programId: `${ORG1_ID}-prog-rec-bronze`, // Link to Bronze program
      date: daysAgo(14),
      levelId: `${ORG1_ID}-level-bronze`,
      overallScore: 7.5,
      status: "PASS",
      notes:
        "Emily is making great progress! Strong tumbling skills. Keep working on bar endurance.",
    },
  });

  // Skill ratings for eval1 - mix of succeeded, attempted, and not attempted (Pass/Fail scoring)
  const eval1Skills = [
    {
      skillId: `${ORG1_ID}-skill-1`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Perfect forward roll with smooth momentum",
    },
    {
      skillId: `${ORG1_ID}-skill-2`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Good backward roll, chin nicely tucked",
    },
    {
      skillId: `${ORG1_ID}-skill-3`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Beautiful cartwheel, straight legs",
    },
    {
      skillId: `${ORG1_ID}-skill-11`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Almost there! Needs stronger punch off board",
    },
    {
      skillId: `${ORG1_ID}-skill-14`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Working on pulling hips to bar",
    },
    {
      skillId: `${ORG1_ID}-skill-19`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Confident beam walking",
    },
    {
      skillId: `${ORG1_ID}-skill-20`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Nice deep dips",
    },
    {
      skillId: `${ORG1_ID}-skill-27`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Strong hollow hold",
    },
  ];

  for (const skill of eval1Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval1.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval1.id, ...skill },
    });
  }

  // Evaluation 2 - Sophie (Silver athlete) - Completed Rec Level 2 (Point Scale scoring)
  const eval2 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-2` },
    update: { programId: `${ORG1_ID}-prog-rec-silver` },
    create: {
      id: `${ORG1_ID}-eval-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level2`,
      programId: `${ORG1_ID}-prog-rec-silver`, // Link to Silver program
      date: daysAgo(21),
      levelId: `${ORG1_ID}-level-silver`,
      overallScore: 8.5,
      status: "EXCELLENT",
      notes: "Sophie is ready for pre-team evaluation! Excellent work ethic and technique.",
    },
  });

  // Point scale scoring (1-10, pass threshold 7) for eval2
  const eval2Skills = [
    {
      skillId: `${ORG1_ID}-skill-4`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 9,
      passed: true,
      comment: "Beautiful handstand form",
    },
    {
      skillId: `${ORG1_ID}-skill-6`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 8,
      passed: true,
      comment: "Strong round-off with good snap",
    },
    {
      skillId: `${ORG1_ID}-skill-7`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 9,
      passed: true,
      comment: "Controlled back walkover",
    },
    {
      skillId: `${ORG1_ID}-skill-12`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 8,
      passed: true,
      comment: "Clean straddle over vault",
    },
    {
      skillId: `${ORG1_ID}-skill-15`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 9,
      passed: true,
      comment: "Smooth back hip circle",
    },
    {
      skillId: `${ORG1_ID}-skill-17`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 8,
      passed: true,
      comment: "High cast with good form",
    },
    {
      skillId: `${ORG1_ID}-skill-21`,
      attemptStatus: "SUCCEEDED" as const,
      pointScore: 9,
      passed: true,
      comment: "Confident beam turns",
    },
    {
      skillId: `${ORG1_ID}-skill-22`,
      attemptStatus: "ATTEMPTED" as const,
      pointScore: 6,
      passed: false,
      comment: "Working on leg height in scale",
    },
  ];

  for (const skill of eval2Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval2.id, skillId: skill.skillId } },
      update: { passed: skill.passed, pointScore: skill.pointScore },
      create: { evaluationId: eval2.id, ...skill },
    });
  }

  // Evaluation 3 - Olivia (JO athlete) - Pre-Team Assessment - PASS
  const eval3 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-3` },
    update: { programId: `${ORG1_ID}-prog-jo` },
    create: {
      id: `${ORG1_ID}-eval-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      coachId: org1Coach2.id,
      templateId: `${ORG1_ID}-template-preteam`,
      programId: `${ORG1_ID}-prog-jo`, // Link to JO program
      date: daysAgo(45),
      levelId: `${ORG1_ID}-level-silver`,
      overallScore: 8.0,
      status: "PASS",
      notes: "Olivia has passed the pre-team assessment and is ready to join the JO team!",
    },
  });

  // Pass/Fail scoring for Pre-Team (all skills must pass)
  const eval3Skills = [
    {
      skillId: `${ORG1_ID}-skill-6`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Excellent round-off",
    },
    {
      skillId: `${ORG1_ID}-skill-7`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Good flexibility",
    },
    {
      skillId: `${ORG1_ID}-skill-8`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Nice front walkover",
    },
    {
      skillId: `${ORG1_ID}-skill-13`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Strong vault",
    },
    {
      skillId: `${ORG1_ID}-skill-17`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "High cast",
    },
    {
      skillId: `${ORG1_ID}-skill-18`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Almost has the kip - keep practicing!",
    },
    {
      skillId: `${ORG1_ID}-skill-23`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Confident beam cartwheel",
    },
    {
      skillId: `${ORG1_ID}-skill-24`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Good start on beam handstand",
    },
  ];

  for (const skill of eval3Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval3.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval3.id, ...skill },
    });
  }

  // Evaluation 4 - Lily (Bronze athlete) - Pending Rec Level 1
  const eval4 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-4` },
    update: { programId: `${ORG1_ID}-prog-rec-bronze` },
    create: {
      id: `${ORG1_ID}-eval-4`,
      athleteId: `${ORG1_ID}-ath-4`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level1`,
      programId: `${ORG1_ID}-prog-rec-bronze`, // Link to Bronze program
      date: daysFromNow(7),
      levelId: `${ORG1_ID}-level-bronze`,
      overallScore: 0,
      status: "PENDING",
      notes: null,
    },
  });

  // Create NOT_ATTEMPTED skill ratings for pending evaluation
  const eval4SkillIds = [
    `${ORG1_ID}-skill-1`,
    `${ORG1_ID}-skill-2`,
    `${ORG1_ID}-skill-3`,
    `${ORG1_ID}-skill-11`,
    `${ORG1_ID}-skill-14`,
    `${ORG1_ID}-skill-19`,
    `${ORG1_ID}-skill-20`,
    `${ORG1_ID}-skill-27`,
  ];
  for (const skillId of eval4SkillIds) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval4.id, skillId } },
      update: { passed: false },
      create: { evaluationId: eval4.id, skillId, attemptStatus: "NOT_ATTEMPTED", passed: false },
    });
  }

  // Evaluation 5 - Hannah (Preschool) - Completed Preschool Basics
  const eval5 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-5` },
    update: { programId: `${ORG1_ID}-prog-preschool` },
    create: {
      id: `${ORG1_ID}-eval-5`,
      athleteId: `${ORG1_ID}-ath-8`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-preschool`,
      programId: `${ORG1_ID}-prog-preschool`, // Link to Preschool program
      date: daysAgo(7),
      levelId: `${ORG1_ID}-level-preschool`,
      overallScore: 6.0,
      status: "SATISFACTORY",
      notes: "Hannah is doing great for her age! Very enthusiastic and always trying her best.",
    },
  });

  const eval5Skills = [
    {
      skillId: `${ORG1_ID}-skill-1`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Getting the roll!",
    },
    {
      skillId: `${ORG1_ID}-skill-3`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Working on straight legs",
    },
    {
      skillId: `${ORG1_ID}-skill-5`,
      attemptStatus: "ATTEMPTED" as const,
      passed: false,
      comment: "Almost pushing up!",
    },
    {
      skillId: `${ORG1_ID}-skill-19`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Great balance!",
    },
    {
      skillId: `${ORG1_ID}-skill-25`,
      attemptStatus: "SUCCEEDED" as const,
      passed: true,
      comment: "Good flexibility",
    },
  ];

  for (const skill of eval5Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval5.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval5.id, ...skill },
    });
  }

  console.log("  ✓ Created 5 evaluations with skill ratings");

  // ============================================
  // ATHLETE ACHIEVEMENTS (Earned from completed evaluations)
  // ============================================
  console.log("\n🎖️ Creating athlete achievements...");

  const athleteAchievementsData = [
    // Emily earned Rec Level 1 Champion
    {
      id: `${ORG1_ID}-athlete-ach-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      achievementId: `${ORG1_ID}-achievement-rec-level1`,
      evaluationId: eval1.id,
      earnedAt: daysAgo(14),
      bestResultsByCategory: { Floor: 100, Vault: 50, Bars: 50, Beam: 100, Conditioning: 100 },
      overallScore: 7.5,
    },
    // Sophie earned Rec Level 2 Star
    {
      id: `${ORG1_ID}-athlete-ach-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      achievementId: `${ORG1_ID}-achievement-rec-level2`,
      evaluationId: eval2.id,
      earnedAt: daysAgo(21),
      bestResultsByCategory: { Floor: 9, Vault: 8, Bars: 8.5, Beam: 8, Conditioning: 9 },
      overallScore: 8.5,
    },
    // Olivia earned Pre-Team Ready
    {
      id: `${ORG1_ID}-athlete-ach-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      achievementId: `${ORG1_ID}-achievement-preteam`,
      evaluationId: eval3.id,
      earnedAt: daysAgo(45),
      bestResultsByCategory: { Floor: 100, Vault: 100, Bars: 50, Beam: 75 },
      overallScore: 8.0,
    },
    // Hannah earned Preschool Graduate
    {
      id: `${ORG1_ID}-athlete-ach-4`,
      athleteId: `${ORG1_ID}-ath-8`,
      achievementId: `${ORG1_ID}-achievement-preschool`,
      evaluationId: eval5.id,
      earnedAt: daysAgo(7),
      bestResultsByCategory: { Floor: 66, Beam: 100, Flexibility: 100 },
      overallScore: 6.0,
    },
  ];

  for (const achievement of athleteAchievementsData) {
    await prisma.athleteAchievement.upsert({
      where: { id: achievement.id },
      update: {},
      create: achievement,
    });
  }

  console.log(`  ✓ Created ${athleteAchievementsData.length} athlete achievements`);

  // ============================================
  // ATHLETE SKILL PROGRESS (Aggregated from evaluations)
  // ============================================
  console.log("\n📊 Creating athlete skill progress records...");

  // Emily's skill progress
  const emilyProgress = [
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-1`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 3,
      successCount: 2,
      firstAttemptedAt: daysAgo(60),
      firstSucceededAt: daysAgo(30),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-2`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 4,
      successCount: 2,
      firstAttemptedAt: daysAgo(55),
      firstSucceededAt: daysAgo(14),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-3`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 5,
      successCount: 3,
      firstAttemptedAt: daysAgo(50),
      firstSucceededAt: daysAgo(21),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-11`,
      bestStatus: "ATTEMPTED" as const,
      attemptCount: 2,
      successCount: 0,
      firstAttemptedAt: daysAgo(28),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-14`,
      bestStatus: "ATTEMPTED" as const,
      attemptCount: 3,
      successCount: 0,
      firstAttemptedAt: daysAgo(35),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-19`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 2,
      successCount: 2,
      firstAttemptedAt: daysAgo(45),
      firstSucceededAt: daysAgo(45),
      lastEvaluatedAt: daysAgo(14),
    },
    {
      athleteId: `${ORG1_ID}-ath-1`,
      skillId: `${ORG1_ID}-skill-27`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 4,
      successCount: 3,
      firstAttemptedAt: daysAgo(40),
      firstSucceededAt: daysAgo(28),
      lastEvaluatedAt: daysAgo(14),
    },
  ];

  for (const progress of emilyProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }

  // Sophie's skill progress (more advanced)
  const sophieProgress = [
    {
      athleteId: `${ORG1_ID}-ath-2`,
      skillId: `${ORG1_ID}-skill-4`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 5,
      successCount: 4,
      firstAttemptedAt: daysAgo(90),
      firstSucceededAt: daysAgo(60),
      lastEvaluatedAt: daysAgo(21),
    },
    {
      athleteId: `${ORG1_ID}-ath-2`,
      skillId: `${ORG1_ID}-skill-6`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 6,
      successCount: 5,
      firstAttemptedAt: daysAgo(80),
      firstSucceededAt: daysAgo(45),
      lastEvaluatedAt: daysAgo(21),
    },
    {
      athleteId: `${ORG1_ID}-ath-2`,
      skillId: `${ORG1_ID}-skill-7`,
      bestStatus: "SUCCEEDED" as const,
      attemptCount: 4,
      successCount: 3,
      firstAttemptedAt: daysAgo(70),
      firstSucceededAt: daysAgo(35),
      lastEvaluatedAt: daysAgo(21),
    },
    {
      athleteId: `${ORG1_ID}-ath-2`,
      skillId: `${ORG1_ID}-skill-22`,
      bestStatus: "ATTEMPTED" as const,
      attemptCount: 3,
      successCount: 0,
      firstAttemptedAt: daysAgo(40),
      lastEvaluatedAt: daysAgo(21),
    },
  ];

  for (const progress of sophieProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }

  console.log(
    `  ✓ Created ${emilyProgress.length + sophieProgress.length} athlete skill progress records`
  );

  // ============================================
  // ANNOUNCEMENTS (Organization-level)
  // ============================================
  console.log("\n📢 Creating announcements...");
  const announcementData = [
    {
      id: `${ORG1_ID}-ann-1`,
      title: "Spring Competition Registration Open",
      content:
        "<p>Registration for our <strong>Annual Spring Invitational</strong> is now open!</p><p>Don't miss out - spots fill up fast.</p>",
      priority: "HIGH" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(3),
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-ann-2`,
      title: "STARSkate Team Meeting",
      content:
        "<p>Mandatory parent meeting for all <strong>JO team families</strong>.</p><ul><li>Date: This Saturday</li><li>Time: 10:00 AM</li><li>Location: Main Gym</li></ul>",
      priority: "NORMAL" as const,
      targetProgramId: `${ORG1_ID}-prog-jo`,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(1),
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-ann-3`,
      title: "Gym Closure Notice",
      content:
        "<p><strong>IMPORTANT:</strong> The gym will be closed next Monday for maintenance.</p>",
      priority: "URGENT" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(0),
      organizationId: ORG1_ID,
    },
  ];
  for (const ann of announcementData) {
    await prisma.announcement.upsert({ where: { id: ann.id }, update: {}, create: ann });
  }
  console.log(`  ✓ Created ${announcementData.length} organization announcements`);

  // ============================================
  // SYSTEM ANNOUNCEMENTS (Superadmin platform-wide)
  // ============================================
  console.log("\n🌐 Creating system announcements...");
  const systemAnnouncementData = [
    {
      id: "sys-ann-1",
      title: "Welcome to Uplifter!",
      content:
        "<p>Welcome to the <strong>Uplifter</strong> platform! We're excited to have you.</p><p>Check out these resources to get started:</p><ul><li>Documentation &amp; guides</li><li>Video tutorials</li><li>Support team availability</li></ul>",
      priority: "NORMAL" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(14),
      createdById: andrewUser.id,
    },
    {
      id: "sys-ann-2",
      title: "New Feature: SMS Messaging",
      content:
        "<p>We've launched <strong>SMS messaging</strong> capabilities!</p><p>You can now send text messages to athletes and families directly from the platform. Check out the Communication section to get started.</p>",
      priority: "HIGH" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(7),
      createdById: andrewUser.id,
    },
    {
      id: "sys-ann-3",
      title: "Scheduled Maintenance - Feb 15",
      content:
        "<p><strong>Scheduled Maintenance Notice</strong></p><p>We will be performing system maintenance on <strong>February 15th from 2:00 AM - 4:00 AM EST</strong>.</p><p>During this time, the platform may be temporarily unavailable. We apologize for any inconvenience.</p>",
      priority: "URGENT" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(2),
      expiresAt: daysFromNow(30),
      createdById: andrewUser.id,
    },
    {
      id: "sys-ann-4",
      title: "Tips for Maximizing Your Experience",
      content:
        "<p>Here are some tips to get the most out of Uplifter:</p><ol><li>Set up your organization branding</li><li>Configure your programs and pricing</li><li>Invite your staff members</li><li>Start enrolling athletes!</li></ol>",
      priority: "LOW" as const,
      status: "PUBLISHED" as const,
      publishedAt: daysAgo(10),
      createdById: andrewUser.id,
    },
    {
      id: "sys-ann-5",
      title: "Draft: Upcoming Feature Preview",
      content: "<p>This is a draft announcement about an upcoming feature...</p>",
      priority: "NORMAL" as const,
      status: "DRAFT" as const,
      createdById: andrewUser.id,
    },
  ];
  for (const ann of systemAnnouncementData) {
    await prisma.systemAnnouncement.upsert({ where: { id: ann.id }, update: {}, create: ann });
  }
  console.log(`  ✓ Created ${systemAnnouncementData.length} system announcements`);

  // ============================================
  // WEBSITE CONFIGS
  // ============================================
  console.log("\n🌐 Creating website configurations...");

  // Default info box content
  const defaultInfoBox1Title = "Membership Includes";
  const defaultInfoBox1Content =
    "<ul><li>Access to all registered programs</li><li>Facility and equipment access</li><li>Member communications and updates</li><li>Participation in club events</li></ul>";
  const defaultInfoBox2Title = "Financial Assistance";
  const defaultInfoBox2Content =
    "<p>We believe in accessible athletics for all. Financial assistance may be available for qualifying families. Contact us for more information about assistance options.</p>";
  const defaultInfoBox3Title = "Get Involved";
  const defaultInfoBox3Content =
    "<p>We run on community support. Volunteer opportunities are available for parents and members who want to contribute to our programs and events.</p>";

  // Create configs for all organizations
  await Promise.all([
    prisma.websiteConfig.upsert({
      where: { organizationId: ORG1_ID },
      update: { showTeam: true },
      create: {
        organizationId: ORG1_ID,
        subdomain: "sunrise-skating",
        primaryColor: "#FF6B35",
        secondaryColor: "#004E89",
        heroHeadline: "Where Champions Begin",
        heroSubheadline: "Building confidence through figure skating",
        heroAgeRange: "Ages 3-18",
        heroProgramPeriods: "Year-Round Programs",
        heroLocation: "Sunnyvale, CA",
        showCalendar: true,
        showRegistration: true,
        showContact: true,
        showTeam: true,
        isPublished: true,
        infoBox1Title: defaultInfoBox1Title,
        infoBox1Content: defaultInfoBox1Content,
        infoBox2Title: defaultInfoBox2Title,
        infoBox2Content: defaultInfoBox2Content,
        infoBox3Title: defaultInfoBox3Title,
        infoBox3Content: defaultInfoBox3Content,
      },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: orgDemo.id },
      update: {},
      create: {
        organizationId: orgDemo.id,
        subdomain: "demo-gym",
        primaryColor: "#3B82F6",
        secondaryColor: "#10B981",
        heroHeadline: "Welcome to Demo Skating",
        heroSubheadline: "Your figure skating journey starts here",
        heroAgeRange: "All Ages Welcome",
        heroProgramPeriods: "Year-Round Programs",
        heroLocation: "Anytown, USA",
        showCalendar: true,
        showRegistration: true,
        showContact: true,
        isPublished: true,
        infoBox1Title: defaultInfoBox1Title,
        infoBox1Content: defaultInfoBox1Content,
        infoBox2Title: defaultInfoBox2Title,
        infoBox2Content: defaultInfoBox2Content,
        infoBox3Title: defaultInfoBox3Title,
        infoBox3Content: defaultInfoBox3Content,
      },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: orgUplifter.id },
      update: {},
      create: {
        organizationId: orgUplifter.id,
        subdomain: "uplifter",
        primaryColor: "#8B5CF6",
        secondaryColor: "#EC4899",
        heroHeadline: "Uplifter Platform",
        heroSubheadline: "Empowering sports organizations",
        showCalendar: true,
        showRegistration: true,
        showContact: true,
        isPublished: true,
        infoBox1Title: defaultInfoBox1Title,
        infoBox1Content: defaultInfoBox1Content,
        infoBox2Title: defaultInfoBox2Title,
        infoBox2Content: defaultInfoBox2Content,
        infoBox3Title: defaultInfoBox3Title,
        infoBox3Content: defaultInfoBox3Content,
      },
    }),
  ]);

  console.log("  ✓ Created 4 website configurations");

  // ============================================
  // TEAM MEMBER HIGHLIGHTS (Sunrise Skating)
  // ============================================
  // Seeded so the public team page has 5 visible staffers, exercising the 2-column desktop layout (USC-350).
  console.log("\n🌟 Creating team member highlights for sunrise-skating...");
  const sunriseTeamHighlights: Array<{
    memberId: string;
    title: string;
    bio: string;
  }> = [
    {
      memberId: org1AdminMember.id,
      title: "Club Director",
      bio: "Jennifer leads Sunrise with 20+ years of figure skating coaching and program design. She founded the club to build a home where kids of every level can find their fit and stay in love with the sport.",
    },
    {
      memberId: org1Coach1Member.id,
      title: "Head Coach, Competitive Team",
      bio: "Maria guides our competitive athletes from first program to regional finals. A former national-level competitor, she brings a calm, technical eye and a relentless belief in steady, confident progress.",
    },
    {
      memberId: org1Coach2Member.id,
      title: "Recreational Program Lead",
      bio: "James runs our recreational program and parent-and-tot Snowplow Sam classes. He specializes in making the first day on the ice feel safe and fun — and in giving every family a clear path for what comes next.",
    },
    {
      memberId: org1Coach3Member.id,
      title: "Tumbling & Trampoline Coach",
      bio: "Ava coaches our tumbling and trampoline squads and runs our summer skills camps. She loves the moment an athlete lands a new skill for the first time and the quiet work it takes to get there.",
    },
    {
      memberId: org1AccountantMember.id,
      title: "Operations & Finance",
      bio: "Robert keeps the club running behind the scenes — tuition, scheduling, invoicing, and making sure coaches have what they need on the floor. He's the first person families meet at the front desk.",
    },
  ];

  await Promise.all(
    sunriseTeamHighlights.map((highlight, index) =>
      prisma.teamMemberHighlight.upsert({
        where: {
          organizationId_memberId: {
            organizationId: ORG1_ID,
            memberId: highlight.memberId,
          },
        },
        update: {
          title: highlight.title,
          bio: highlight.bio,
          isVisible: true,
          displayOrder: index,
        },
        create: {
          id: `${ORG1_ID}-team-highlight-${index + 1}`,
          organizationId: ORG1_ID,
          memberId: highlight.memberId,
          title: highlight.title,
          bio: highlight.bio,
          isVisible: true,
          displayOrder: index,
        },
      })
    )
  );
  console.log(`  ✓ Created ${sunriseTeamHighlights.length} team highlights for sunrise-skating`);

  // ============================================
  // PRODUCTS (POS)
  // ============================================
  console.log("\n🛍️ Creating products...");
  await Promise.all([
    prisma.product.upsert({
      where: { id: `${ORG1_ID}-prod-1` },
      update: { fulfillmentType: "PICKUP_ONLY", pickupFacilityId: org1Facility1.id },
      create: {
        id: `${ORG1_ID}-prod-1`,
        organizationId: ORG1_ID,
        name: "Competition Leotard",
        description: "Official team competition leotard",
        sku: "LEO-COMP-001",
        category: "Apparel",
        price: 89.99,
        maxInventory: 50,
        currentInventory: 35,
        isActive: true,
        fulfillmentType: "PICKUP_ONLY",
        pickupFacilityId: org1Facility1.id,
      },
    }),
    prisma.product.upsert({
      where: { id: `${ORG1_ID}-prod-2` },
      update: { fulfillmentType: "PICKUP_ONLY", pickupFacilityId: org1Facility1.id },
      create: {
        id: `${ORG1_ID}-prod-2`,
        organizationId: ORG1_ID,
        name: "Practice Leotard",
        sku: "LEO-PRAC-001",
        category: "Apparel",
        price: 45.0,
        maxInventory: 100,
        currentInventory: 72,
        isActive: true,
        fulfillmentType: "PICKUP_ONLY",
        pickupFacilityId: org1Facility1.id,
      },
    }),
    prisma.product.upsert({
      where: { id: `${ORG1_ID}-prod-3` },
      update: { fulfillmentType: "PICKUP_ONLY", pickupFacilityId: org1Facility1.id },
      create: {
        id: `${ORG1_ID}-prod-3`,
        organizationId: ORG1_ID,
        name: "Skate Guards",
        sku: "GUARD-001",
        category: "Equipment",
        price: 65.0,
        maxInventory: 30,
        currentInventory: 18,
        isActive: true,
        fulfillmentType: "PICKUP_ONLY",
        pickupFacilityId: org1Facility1.id,
      },
    }),
    prisma.product.upsert({
      where: { id: `${ORG1_ID}-prod-4` },
      update: { fulfillmentType: "PICKUP_ONLY", pickupFacilityId: org1Facility1.id },
      create: {
        id: `${ORG1_ID}-prod-4`,
        organizationId: ORG1_ID,
        name: "Water Bottle",
        sku: "BOTTLE-001",
        category: "Accessories",
        price: 12.0,
        isActive: true,
        fulfillmentType: "PICKUP_ONLY",
        pickupFacilityId: org1Facility1.id,
      },
    }),
  ]);
  console.log("  ✓ Created 4 products");

  // ============================================
  // STOCK MOVEMENTS
  // ============================================
  console.log("\n📦 Creating stock movements...");
  const stockMovementData = [
    {
      id: `${ORG1_ID}-sm-1`,
      productId: `${ORG1_ID}-prod-1`,
      type: "RESTOCK" as const,
      quantity: 50,
      previousQty: 0,
      newQty: 50,
      notes: "Initial inventory",
    },
    {
      id: `${ORG1_ID}-sm-2`,
      productId: `${ORG1_ID}-prod-1`,
      type: "SALE" as const,
      quantity: -15,
      previousQty: 50,
      newQty: 35,
      notes: "Competition season sales",
    },
  ];
  for (const sm of stockMovementData) {
    await prisma.stockMovement.upsert({ where: { id: sm.id }, update: {}, create: sm });
  }
  console.log(`  ✓ Created ${stockMovementData.length} stock movements`);

  // ============================================
  // FEATURE REQUESTS
  // ============================================
  console.log("\n💡 Creating feature requests...");

  // Public features on the roadmap
  const feature1 = await prisma.featureRequest.upsert({
    where: { id: "feature-1" },
    update: {},
    create: {
      id: "feature-1",
      title: "Mobile app for parents",
      description:
        "A dedicated mobile app where parents can check schedules, receive notifications, make payments, and track their child's progress. Features would include push notifications, calendar sync, and payment history.",
      status: "IN_PROGRESS",
      isPublic: true,
      categories: ["Mobile", "Communication"],
      targetDate: daysFromNow(60), // Q1 2026
      statusChangedAt: daysAgo(14),
      userId: org1Admin.id,
    },
  });

  const feature2 = await prisma.featureRequest.upsert({
    where: { id: "feature-2" },
    update: {},
    create: {
      id: "feature-2",
      title: "Automated attendance tracking",
      description:
        "QR code or RFID-based check-in system that automatically records attendance when athletes enter the facility. Would integrate with existing scheduling system.",
      status: "PLANNED",
      isPublic: true,
      categories: ["Athletes", "Scheduling"],
      targetDate: daysFromNow(120), // Q2 2026
      statusChangedAt: daysAgo(7),
      userId: org1Admin.id,
    },
  });

  const feature3 = await prisma.featureRequest.upsert({
    where: { id: "feature-3" },
    update: {},
    create: {
      id: "feature-3",
      title: "Dark mode support",
      description:
        "Add a dark mode theme option across all dashboards and portals for better visibility in low-light environments and reduced eye strain.",
      status: "DONE",
      isPublic: true,
      categories: ["UI/UX"],
      targetDate: daysAgo(30),
      statusChangedAt: daysAgo(5),
      userId: org1Coach1.id,
    },
  });

  const feature4 = await prisma.featureRequest.upsert({
    where: { id: "feature-4" },
    update: {},
    create: {
      id: "feature-4",
      title: "Integration with Stripe for payments",
      description:
        "Add Stripe as an alternative payment processor alongside Adyen for organizations that prefer Stripe.",
      status: "PLANNED",
      isPublic: true,
      categories: ["Integrations", "Financials"],
      targetDate: daysFromNow(180), // Q3 2026
      statusChangedAt: daysAgo(21),
      userId: org1Admin.id,
    },
  });

  const feature5 = await prisma.featureRequest.upsert({
    where: { id: "feature-5" },
    update: {},
    create: {
      id: "feature-5",
      title: "Advanced analytics dashboard",
      description:
        "Comprehensive analytics with custom date ranges, exportable reports, athlete progress tracking over time, and financial trend analysis.",
      status: "IN_PROGRESS",
      isPublic: true,
      categories: ["Analytics", "UI/UX"],
      targetDate: daysFromNow(45),
      statusChangedAt: daysAgo(10),
      userId: org1Admin.id,
    },
  });

  // Pending submission (not public)
  const feature6 = await prisma.featureRequest.upsert({
    where: { id: "feature-6" },
    update: {},
    create: {
      id: "feature-6",
      title: "Bulk athlete import from CSV",
      description:
        "Allow administrators to import multiple athletes at once using a CSV file upload. Would save significant time during initial setup or new season registration.",
      status: "SUBMITTED",
      isPublic: false,
      categories: ["Athletes"],
      userId: org1Coach1.id,
    },
  });

  // Feature votes
  const voteData = [
    { id: "vote-1-1", featureRequestId: feature1.id, userId: org1Admin.id },
    { id: "vote-1-2", featureRequestId: feature1.id, userId: org1Coach1.id },
    { id: "vote-2-1", featureRequestId: feature2.id, userId: org1Admin.id },
    { id: "vote-3-1", featureRequestId: feature3.id, userId: org1Coach1.id },
    { id: "vote-4-1", featureRequestId: feature4.id, userId: org1Admin.id },
    { id: "vote-4-3", featureRequestId: feature4.id, userId: org1Coach1.id },
    { id: "vote-5-1", featureRequestId: feature5.id, userId: org1Admin.id },
  ];
  for (const vote of voteData) {
    await prisma.featureVote.upsert({ where: { id: vote.id }, update: {}, create: vote });
  }

  // Feature comments
  await prisma.featureComment.upsert({
    where: { id: "fc-1" },
    update: {},
    create: {
      id: "fc-1",
      featureRequestId: feature1.id,
      content: "This would be amazing! Parents constantly ask about a mobile app.",
      userId: org1Coach1.id,
      isStaffReply: false,
    },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-2" },
    update: {},
    create: {
      id: "fc-2",
      featureRequestId: feature1.id,
      content: "We're actively working on this! Beta testing should begin next month.",
      userId: andrewUser.id,
      isStaffReply: true,
    },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-3" },
    update: {},
    create: {
      id: "fc-3",
      featureRequestId: feature2.id,
      content: "QR codes would be perfect for our setup. Looking forward to this!",
      userId: org1Admin.id,
      isStaffReply: false,
    },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-4" },
    update: {},
    create: {
      id: "fc-4",
      featureRequestId: feature3.id,
      content: "Dark mode is now live! Enjoy the new theme options.",
      userId: andrewUser.id,
      isStaffReply: true,
    },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-5" },
    update: {},
    create: {
      id: "fc-5",
      featureRequestId: feature5.id,
      content: "Can you add export to PDF for reports?",
      userId: org1Admin.id,
      isStaffReply: false,
    },
  });

  console.log("  ✓ Created 6 feature requests, 7 votes, and 5 comments");

  // ============================================
  // MEDIA
  // ============================================
  console.log("\n📷 Creating media...");
  const mediaData = [
    // Sunrise Skating - Coach uploaded media
    {
      id: `${ORG1_ID}-media-1`,
      url: "/defaults/hero-default.ico",
      type: "IMAGE" as const,
      title: "Bronze Class Practice - Floor Routine",
      description: "Emily working on her floor routine fundamentals",
      athleteId: `${ORG1_ID}-ath-1`,
      eventId: `${ORG1_ID}-evt-1`,
      uploadedById: org1Coach1.id,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-media-2`,
      url: "/defaults/hero-default.ico",
      type: "IMAGE" as const,
      title: "Silver Team Group Photo",
      description: "Team photo after a great practice session",
      athleteId: null,
      eventId: `${ORG1_ID}-evt-2`,
      uploadedById: org1Coach1.id,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-media-3`,
      url: "/defaults/hero-default.ico",
      type: "IMAGE" as const,
      title: "Cartwheel Progress",
      description: "Sophie's cartwheel improvement over the month",
      athleteId: `${ORG1_ID}-ath-2`,
      eventId: null,
      uploadedById: org1Coach2.id,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-media-4`,
      url: "/defaults/hero-default.ico",
      type: "IMAGE" as const,
      title: "STARSkate Team Practice",
      description: "Level 4 athletes during beam practice",
      athleteId: `${ORG1_ID}-ath-3`,
      eventId: `${ORG1_ID}-evt-3`,
      uploadedById: org1Coach1.id,
      organizationId: ORG1_ID,
    },
  ];
  for (const m of mediaData) {
    await prisma.media.upsert({ where: { id: m.id }, update: {}, create: m });
  }
  console.log(`  ✓ Created ${mediaData.length} media items`);

  // ============================================
  // MEMBER EMPLOYMENT DATA
  // ============================================
  console.log("\n👷 Updating members with employment data...");
  const employmentUpdates = [
    {
      memberId: `${ORG1_ID}-staff-1`,
      data: {
        employmentType: "FULL_TIME" as const,
        title: "Head Coach",
        hourlyRate: 35.0,
        hireDate: daysAgo(365),
        phone: "(555) 111-2222",
        emergencyContact: {
          name: "John Rodriguez",
          phone: "(555) 111-3333",
          relationship: "Spouse",
        },
      },
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      data: {
        employmentType: "FULL_TIME" as const,
        title: "STARSkate Team Coach",
        hourlyRate: 32.0,
        hireDate: daysAgo(180),
        phone: "(555) 111-4444",
        emergencyContact: { name: "Lisa Chen", phone: "(555) 111-5555", relationship: "Parent" },
      },
    },
    {
      memberId: `${ORG1_ID}-staff-3`,
      data: {
        employmentType: "PART_TIME" as const,
        title: "Finance & Admin",
        hourlyRate: 25.0,
        hireDate: daysAgo(90),
        phone: "(555) 111-6666",
        emergencyContact: Prisma.DbNull,
      },
    },
  ];
  for (const emp of employmentUpdates) {
    await prisma.organizationMember.update({ where: { id: emp.memberId }, data: emp.data });
  }
  console.log(`  ✓ Updated ${employmentUpdates.length} members with employment data`);

  // ============================================
  // CERTIFICATION DEFINITIONS & MEMBER CERTIFICATIONS
  // ============================================
  console.log("\n🏅 Creating certifications...");

  const certDefs = [
    {
      id: `${ORG1_ID}-cert-usag`,
      orgId: ORG1_ID,
      name: "PSA Coach Certification",
      criteria: "Complete Professional Skaters Association coach certification course",
      renewalPeriodMonths: 12,
    },
    {
      id: `${ORG1_ID}-cert-cpr`,
      orgId: ORG1_ID,
      name: "CPR / First Aid",
      criteria: "Complete ARC CPR/First Aid course and pass practical exam",
      renewalPeriodMonths: 24,
    },
    {
      id: `${ORG1_ID}-cert-safesport`,
      orgId: ORG1_ID,
      name: "SafeSport Trained",
      criteria: "Complete U.S. Center for SafeSport training",
      renewalPeriodMonths: 12,
    },
    {
      id: `${ORG1_ID}-cert-bgcheck`,
      orgId: ORG1_ID,
      name: "Background Check Cleared",
      criteria: "Pass national background check",
      renewalPeriodMonths: null,
    },
  ];

  for (const cd of certDefs) {
    await prisma.certification.upsert({
      where: { id: cd.id },
      update: {},
      create: {
        id: cd.id,
        organizationId: cd.orgId,
        name: cd.name,
        criteria: cd.criteria,
        evaluationMethod: "PASS_FAIL",
        renewalPeriodMonths: cd.renewalPeriodMonths,
        requiredForPrograms: true,
        requiredForEvents: true,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Created ${certDefs.length} certification definitions`);

  const memberCerts = [
    // Org1 staff-1 (Head Coach): PSA, CPR, SafeSport
    {
      certId: `${ORG1_ID}-cert-usag`,
      memberId: `${ORG1_ID}-staff-1`,
      grantedAt: daysAgo(90),
      expiresAt: daysFromNow(180),
    },
    {
      certId: `${ORG1_ID}-cert-cpr`,
      memberId: `${ORG1_ID}-staff-1`,
      grantedAt: daysAgo(90),
      expiresAt: daysFromNow(365),
    },
    {
      certId: `${ORG1_ID}-cert-safesport`,
      memberId: `${ORG1_ID}-staff-1`,
      grantedAt: daysAgo(90),
      expiresAt: daysFromNow(730),
    },
    // Org1 staff-2 (Competitive Team Coach): PSA, SafeSport
    {
      certId: `${ORG1_ID}-cert-usag`,
      memberId: `${ORG1_ID}-staff-2`,
      grantedAt: daysAgo(60),
      expiresAt: daysFromNow(300),
    },
    {
      certId: `${ORG1_ID}-cert-safesport`,
      memberId: `${ORG1_ID}-staff-2`,
      grantedAt: daysAgo(60),
      expiresAt: daysFromNow(500),
    },
    // Org1 staff-3 (Finance): Background Check (no expiry)
    {
      certId: `${ORG1_ID}-cert-bgcheck`,
      memberId: `${ORG1_ID}-staff-3`,
      grantedAt: daysAgo(90),
      expiresAt: null,
    },
  ];

  for (const mc of memberCerts) {
    await prisma.memberCertification.upsert({
      where: { certificationId_memberId: { certificationId: mc.certId, memberId: mc.memberId } },
      update: {},
      create: {
        certificationId: mc.certId,
        memberId: mc.memberId,
        passed: true,
        grantedAt: mc.grantedAt,
        expiresAt: mc.expiresAt,
      },
    });
  }
  console.log(`  ✓ Created ${memberCerts.length} member certifications`);

  // ============================================
  // MEMBER AVAILABILITY
  // ============================================
  console.log("\n📅 Creating member availability...");
  const availabilityData = [
    // Org1 Coach 1 - Available weekdays 8am-6pm
    {
      memberId: `${ORG1_ID}-staff-1`,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-1`,
      dayOfWeek: 2,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-1`,
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-1`,
      dayOfWeek: 4,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-1`,
      dayOfWeek: 5,
      startTime: "08:00",
      endTime: "18:00",
      isAvailable: true,
    },
    // Org1 Coach 2 - Afternoons and evenings
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 1,
      startTime: "14:00",
      endTime: "21:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 2,
      startTime: "14:00",
      endTime: "21:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 3,
      startTime: "14:00",
      endTime: "21:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 4,
      startTime: "14:00",
      endTime: "21:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 5,
      startTime: "14:00",
      endTime: "21:00",
      isAvailable: true,
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      dayOfWeek: 6,
      startTime: "09:00",
      endTime: "14:00",
      isAvailable: true,
    },
  ];
  for (const avail of availabilityData) {
    await prisma.memberAvailability.upsert({
      where: { memberId_dayOfWeek: { memberId: avail.memberId, dayOfWeek: avail.dayOfWeek } },
      update: {},
      create: avail,
    });
  }
  console.log(`  ✓ Created ${availabilityData.length} availability entries`);

  // ============================================
  // SHIFTS
  // ============================================
  console.log("\n⏰ Creating shifts...");
  const shiftData = [
    // Today and upcoming shifts for Org1
    {
      id: `${ORG1_ID}-shift-1`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
      date: today,
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      status: "IN_PROGRESS" as const,
    },
    {
      id: `${ORG1_ID}-shift-2`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
      date: today,
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      status: "SCHEDULED" as const,
    },
    {
      id: `${ORG1_ID}-shift-3`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
      date: daysFromNow(1),
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      status: "SCHEDULED" as const,
    },
    {
      id: `${ORG1_ID}-shift-4`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
      date: daysFromNow(1),
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      status: "SCHEDULED" as const,
    },
    {
      id: `${ORG1_ID}-shift-5`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-3`,
      facilityId: org1Facility1.id,
      date: daysFromNow(2),
      startTime: "09:00",
      endTime: "14:00",
      shiftType: "Front Desk",
      status: "SCHEDULED" as const,
    },
    // Historical shifts (completed)
    {
      id: `${ORG1_ID}-shift-6`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
      date: daysAgo(1),
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      status: "COMPLETED" as const,
    },
    {
      id: `${ORG1_ID}-shift-7`,
      organizationId: ORG1_ID,
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
      date: daysAgo(1),
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      status: "COMPLETED" as const,
    },
  ];
  for (const shift of shiftData) {
    await prisma.shift.upsert({ where: { id: shift.id }, update: {}, create: shift });
  }
  console.log(`  ✓ Created ${shiftData.length} shifts`);

  // ============================================
  // SCHEDULE TEMPLATES
  // ============================================
  console.log("\n📋 Creating schedule templates...");
  const template1 = await prisma.scheduleTemplate.upsert({
    where: { id: `${ORG1_ID}-template-1` },
    update: {},
    create: {
      id: `${ORG1_ID}-template-1`,
      organizationId: ORG1_ID,
      name: "Standard Week",
      isActive: true,
    },
  });
  // Template entries
  const templateEntryData = [
    // Org1 Standard Week - Mon-Fri
    {
      id: `${ORG1_ID}-tentry-1`,
      templateId: template1.id,
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
    },
    {
      id: `${ORG1_ID}-tentry-2`,
      templateId: template1.id,
      dayOfWeek: 1,
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
    },
    {
      id: `${ORG1_ID}-tentry-3`,
      templateId: template1.id,
      dayOfWeek: 2,
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
    },
    {
      id: `${ORG1_ID}-tentry-4`,
      templateId: template1.id,
      dayOfWeek: 2,
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
    },
    {
      id: `${ORG1_ID}-tentry-5`,
      templateId: template1.id,
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "16:00",
      shiftType: "Opening Manager",
      memberId: `${ORG1_ID}-staff-1`,
      facilityId: org1Facility1.id,
    },
    {
      id: `${ORG1_ID}-tentry-6`,
      templateId: template1.id,
      dayOfWeek: 3,
      startTime: "16:00",
      endTime: "21:00",
      shiftType: "Closing Manager",
      memberId: `${ORG1_ID}-staff-2`,
      facilityId: org1Facility1.id,
    },
  ];
  for (const entry of templateEntryData) {
    await prisma.scheduleTemplateEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }
  console.log(`  ✓ Created 2 schedule templates with ${templateEntryData.length} entries`);

  // ============================================
  // EVENT STAFF ASSIGNMENTS
  // ============================================
  console.log("\n👥 Creating event staff assignments...");
  const eventStaffData = [
    // Org1 Event Staff
    {
      id: `${ORG1_ID}-es-1`,
      eventId: `${ORG1_ID}-evt-1`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD" as const,
      notes: "Lead instructor",
    },
    {
      id: `${ORG1_ID}-es-2`,
      eventId: `${ORG1_ID}-evt-2`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD" as const,
      notes: null,
    },
    {
      id: `${ORG1_ID}-es-3`,
      eventId: `${ORG1_ID}-evt-3`,
      memberId: `${ORG1_ID}-staff-2`,
      role: "LEAD" as const,
      notes: "STARSkate Team practice lead",
    },
    {
      id: `${ORG1_ID}-es-4`,
      eventId: `${ORG1_ID}-evt-3`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "ASSISTANT" as const,
      notes: "Beam specialist",
    },
    {
      id: `${ORG1_ID}-es-5`,
      eventId: `${ORG1_ID}-evt-4`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD" as const,
      notes: "Competition director",
    },
    {
      id: `${ORG1_ID}-es-6`,
      eventId: `${ORG1_ID}-evt-4`,
      memberId: `${ORG1_ID}-staff-2`,
      role: "ASSISTANT" as const,
      notes: null,
    },
  ];
  for (const es of eventStaffData) {
    await prisma.eventStaff.upsert({
      where: { id: es.id },
      update: {},
      create: es,
    });
  }
  console.log(`  ✓ Created ${eventStaffData.length} event staff assignments`);

  // ============================================
  // PROGRAM STAFF ASSIGNMENTS
  // ============================================
  console.log("\n🏅 Creating program staff assignments...");
  const programStaffData = [
    // Org1 Program Staff
    {
      id: `${ORG1_ID}-ps-1`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD_COACH" as const,
      isPrimary: true,
      notes: "Primary coach for Bronze program",
    },
    {
      id: `${ORG1_ID}-ps-2`,
      programId: `${ORG1_ID}-prog-rec-silver`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD_COACH" as const,
      isPrimary: true,
      notes: null,
    },
    {
      id: `${ORG1_ID}-ps-3`,
      programId: `${ORG1_ID}-prog-rec-gold`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "ASSISTANT_COACH" as const,
      isPrimary: false,
      notes: null,
    },
    {
      id: `${ORG1_ID}-ps-4`,
      programId: `${ORG1_ID}-prog-rec-gold`,
      memberId: `${ORG1_ID}-staff-2`,
      role: "LEAD_COACH" as const,
      isPrimary: true,
      notes: "Primary coach for Gold program",
    },
    {
      id: `${ORG1_ID}-ps-5`,
      programId: `${ORG1_ID}-prog-jo`,
      memberId: `${ORG1_ID}-staff-2`,
      role: "LEAD_COACH" as const,
      isPrimary: true,
      notes: "STARSkate Team Head Coach",
    },
    {
      id: `${ORG1_ID}-ps-6`,
      programId: `${ORG1_ID}-prog-jo`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "ASSISTANT_COACH" as const,
      isPrimary: false,
      notes: "Beam and floor specialist",
    },
    {
      id: `${ORG1_ID}-ps-7`,
      programId: `${ORG1_ID}-prog-preschool`,
      memberId: `${ORG1_ID}-staff-1`,
      role: "LEAD_COACH" as const,
      isPrimary: true,
      notes: null,
    },
  ];
  for (const ps of programStaffData) {
    await prisma.programStaff.upsert({
      where: { id: ps.id },
      update: {},
      create: ps,
    });
  }
  console.log(`  ✓ Created ${programStaffData.length} program staff assignments`);

  // ============================================
  // PROGRAM REQUIREMENTS (Membership Requirements)
  // ============================================
  console.log("\n📋 Setting program membership requirements...");
  // STARSkate Team requires the annual club membership
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-jo` },
    data: {
      requiredMemberships: {
        connect: [{ id: `${ORG1_ID}-mi-2026` }],
      },
    },
  });
  // Gold program requires annual club membership
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-rec-gold` },
    data: {
      requiredMemberships: {
        connect: [{ id: `${ORG1_ID}-mi-2026` }],
      },
    },
  });
  console.log("  ✓ Set membership requirements for 2 programs");

  // ============================================
  // VISITOR ANALYTICS (Redis)
  // ============================================
  if (redis) {
    console.log("\n📊 Seeding visitor analytics...");

    // Get all organizations with published website configs
    const publishedSites = await prisma.websiteConfig.findMany({
      where: { isPublished: true },
      select: { organizationId: true },
    });

    const formatDate = (date: Date): string => date.toISOString().split("T")[0];
    const VISITOR_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

    let totalDaysSeeded = 0;
    let totalDesktopVisitors = 0;
    let totalMobileVisitors = 0;

    for (const site of publishedSites) {
      const orgId = site.organizationId;

      // Seed 90 days of historical data (excluding today)
      // Today will have 0 visitors for easy testing
      for (let daysBack = 1; daysBack <= 90; daysBack++) {
        const date = new Date();
        date.setDate(date.getDate() - daysBack);
        const dateStr = formatDate(date);

        // Calculate visitor count with realistic patterns
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Base visitors: lower on weekends
        const baseVisitors = isWeekend ? 50 : 150;

        // Add variance (0-100)
        const variance = Math.floor(Math.random() * 100);

        // Occasional spikes (10% chance of 2x traffic)
        const spike = Math.random() < 0.1 ? 2 : 1;

        // More recent days tend to have more traffic (growth trend)
        const recencyBonus = Math.floor((90 - daysBack) / 10) * 10;

        const totalVisitors = Math.floor((baseVisitors + variance + recencyBonus) * spike);

        // Split between desktop (~60%) and mobile (~40%) with some variance
        const mobileRatio = 0.35 + Math.random() * 0.1; // 35-45% mobile
        const mobileCount = Math.floor(totalVisitors * mobileRatio);
        const desktopCount = totalVisitors - mobileCount;

        // Generate desktop visitor IDs
        const desktopKey = `visitors:${orgId}:${dateStr}:desktop`;
        if (desktopCount > 0) {
          const desktopIds: [string, ...string[]] = [`seed-desktop-${dateStr}-0`];
          for (let i = 1; i < desktopCount; i++) {
            desktopIds.push(`seed-desktop-${dateStr}-${i}`);
          }
          await redis
            .pipeline()
            .sadd(desktopKey, ...desktopIds)
            .expire(desktopKey, VISITOR_TTL_SECONDS)
            .exec();
          totalDesktopVisitors += desktopCount;
        }

        // Generate mobile visitor IDs
        const mobileKey = `visitors:${orgId}:${dateStr}:mobile`;
        if (mobileCount > 0) {
          const mobileIds: [string, ...string[]] = [`seed-mobile-${dateStr}-0`];
          for (let i = 1; i < mobileCount; i++) {
            mobileIds.push(`seed-mobile-${dateStr}-${i}`);
          }
          await redis
            .pipeline()
            .sadd(mobileKey, ...mobileIds)
            .expire(mobileKey, VISITOR_TTL_SECONDS)
            .exec();
          totalMobileVisitors += mobileCount;
        }

        totalDaysSeeded++;
      }
    }

    console.log(
      `  ✓ Seeded ${totalDaysSeeded} days of visitor analytics for ${publishedSites.length} sites`
    );
    console.log(
      `  ✓ Total: ${(totalDesktopVisitors + totalMobileVisitors).toLocaleString()} visitors (${totalDesktopVisitors.toLocaleString()} desktop, ${totalMobileVisitors.toLocaleString()} mobile)`
    );
    console.log("  ℹ Today has 0 visitors (for testing)");
  } else {
    console.log("\n📊 Skipping visitor analytics (Redis not configured)");
    console.log("  ℹ Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable");
  }

  // ============================================
  // MEDICAL INFORMATION
  // ============================================
  console.log("\n💊 Creating medical form configurations...");

  // Medical Form Config for each organization
  await Promise.all([
    prisma.medicalFormConfig.upsert({
      where: { organizationId: ORG1_ID },
      update: {},
      create: {
        organizationId: ORG1_ID,
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: true,
        collectInsuranceInfo: false,
      },
    }),
  ]);

  console.log("  ✓ Created medical form config for Sunrise organization");

  // Custom Medical Questions
  console.log("📝 Creating custom medical questions...");
  await Promise.all([
    // Sunrise Skating custom questions
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-1` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-1`,
        organizationId: ORG1_ID,
        questionText: "Has your child had any recent injuries that may affect their training?",
        questionType: "YES_NO",
        required: true,
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-2` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-2`,
        organizationId: ORG1_ID,
        questionText: "What is your child's experience level with figure skating?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          "Beginner - No experience",
          "Intermediate - Some classes",
          "Advanced - Competitive experience",
        ],
        required: false,
        displayOrder: 2,
        isActive: true,
      },
    }),
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-3` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-3`,
        organizationId: ORG1_ID,
        questionText: "Are there any specific fears or concerns we should be aware of?",
        questionType: "TEXT",
        required: false,
        displayOrder: 3,
        isActive: true,
      },
    }),
  ]);

  console.log("  ✓ Created 3 custom medical questions");

  // Athlete Medical Info
  console.log("🏥 Creating athlete medical info...");
  const medicalInfoRecords = await Promise.all([
    // Emily Anderson - has allergies
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-1` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-1`,
        allergies: ["Peanuts", "Tree Nuts"],
        medications: [],
        conditions: [],
        dietaryRestrictions: ["Nut-Free"],
        emergencyContactName: "Michelle Anderson",
        emergencyContactPhone: "(555) 101-1001",
        emergencyContactRelation: "Mother",
        additionalNotes: "Carries EpiPen in her bag at all times.",
      },
    }),
    // Sophie Anderson - asthma
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-2` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-2`,
        allergies: [],
        medications: ["Albuterol inhaler (as needed)"],
        conditions: ["Asthma"],
        dietaryRestrictions: [],
        emergencyContactName: "Michelle Anderson",
        emergencyContactPhone: "(555) 101-1001",
        emergencyContactRelation: "Mother",
        additionalNotes: "Inhaler should be easily accessible during intense activities.",
      },
    }),
    // Olivia Chen - no medical concerns
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-3` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-3`,
        allergies: [],
        medications: [],
        conditions: [],
        dietaryRestrictions: [],
        emergencyContactName: "Jennifer Chen",
        emergencyContactPhone: "(555) 102-1002",
        emergencyContactRelation: "Mother",
      },
    }),
    // Mason Williams - ADHD
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-5` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-5`,
        allergies: ["Bee Stings"],
        medications: ["Adderall (morning)"],
        conditions: ["ADHD"],
        dietaryRestrictions: [],
        emergencyContactName: "Robert Williams",
        emergencyContactPhone: "(555) 103-1003",
        emergencyContactRelation: "Father",
        additionalNotes:
          "Takes medication before school. May need extra patience with instructions.",
      },
    }),
    // Ava Patel - lactose intolerant
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-6` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-6`,
        allergies: [],
        medications: [],
        conditions: [],
        dietaryRestrictions: ["Dairy-Free", "Vegetarian"],
        emergencyContactName: "Priya Patel",
        emergencyContactPhone: "(555) 104-1004",
        emergencyContactRelation: "Mother",
      },
    }),
  ]);

  console.log(`  ✓ Created ${medicalInfoRecords.length} athlete medical info records`);

  // Custom Medical Responses
  console.log("📋 Creating custom medical responses...");
  const emilyMedicalInfo = medicalInfoRecords[0];
  const sophieMedicalInfo = medicalInfoRecords[1];

  await Promise.all([
    // Emily's responses
    prisma.customMedicalResponse.upsert({
      where: {
        medicalInfoId_questionId: {
          medicalInfoId: emilyMedicalInfo.id,
          questionId: `${ORG1_ID}-mq-1`,
        },
      },
      update: {},
      create: {
        medicalInfoId: emilyMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-1`,
        response: "No",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: {
        medicalInfoId_questionId: {
          medicalInfoId: emilyMedicalInfo.id,
          questionId: `${ORG1_ID}-mq-2`,
        },
      },
      update: {},
      create: {
        medicalInfoId: emilyMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-2`,
        response: "Intermediate - Some classes",
      },
    }),
    // Sophie's responses
    prisma.customMedicalResponse.upsert({
      where: {
        medicalInfoId_questionId: {
          medicalInfoId: sophieMedicalInfo.id,
          questionId: `${ORG1_ID}-mq-1`,
        },
      },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-1`,
        response: "No",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: {
        medicalInfoId_questionId: {
          medicalInfoId: sophieMedicalInfo.id,
          questionId: `${ORG1_ID}-mq-2`,
        },
      },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-2`,
        response: "Advanced - Competitive experience",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: {
        medicalInfoId_questionId: {
          medicalInfoId: sophieMedicalInfo.id,
          questionId: `${ORG1_ID}-mq-3`,
        },
      },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-3`,
        response: "No specific fears. She loves tumbling!",
      },
    }),
  ]);

  console.log("  ✓ Created 5 custom medical responses");

  // ============================================
  // RESERVED DOMAINS - System and Brand Protection
  // ============================================
  console.log("\n🔒 Creating reserved domains...");
  const reservedDomainData = [
    // System portals - middleware routes (CRITICAL: these are routed by middleware)
    { pattern: "login", type: "EXACT" as const, reason: "System use - login portal" },
    { pattern: "admin", type: "EXACT" as const, reason: "System use - admin portal" },
    { pattern: "superadmin", type: "EXACT" as const, reason: "System use - superadmin portal" },
    { pattern: "coach", type: "EXACT" as const, reason: "System use - coach portal" },
    { pattern: "athletes", type: "EXACT" as const, reason: "System use - athletes portal" },
    { pattern: "pos", type: "EXACT" as const, reason: "System use - POS portal" },
    { pattern: "feedback", type: "EXACT" as const, reason: "System use - feedback portal" },
    { pattern: "events", type: "EXACT" as const, reason: "System use - events portal" },
    { pattern: "startup", type: "EXACT" as const, reason: "System use - org signup portal" },
    { pattern: "my", type: "EXACT" as const, reason: "Reserved - future subsite" },
    {
      pattern: "competition",
      type: "EXACT" as const,
      reason: "Reserved - prevents confusion with competitions portal",
    },
    { pattern: "competitions", type: "EXACT" as const, reason: "System use - competitions portal" },
    {
      pattern: "result",
      type: "EXACT" as const,
      reason: "Reserved - prevents confusion with results portal",
    },
    { pattern: "results", type: "EXACT" as const, reason: "System use - results portal" },

    // Infrastructure
    { pattern: "api", type: "EXACT" as const, reason: "System use - API endpoint" },
    { pattern: "app", type: "EXACT" as const, reason: "System use - application" },
    { pattern: "www", type: "EXACT" as const, reason: "System use - main website" },
    { pattern: "mail", type: "EXACT" as const, reason: "System use - email services" },
    { pattern: "cdn", type: "EXACT" as const, reason: "System use - content delivery" },
    { pattern: "static", type: "EXACT" as const, reason: "System use - static assets" },
    { pattern: "assets", type: "EXACT" as const, reason: "System use - asset hosting" },
    { pattern: "images", type: "EXACT" as const, reason: "System use - image hosting" },
    { pattern: "files", type: "EXACT" as const, reason: "System use - file hosting" },
    { pattern: "download", type: "EXACT" as const, reason: "System use - downloads" },
    { pattern: "upload", type: "EXACT" as const, reason: "System use - uploads" },
    { pattern: "dashboard", type: "EXACT" as const, reason: "System use - dashboard routes" },

    // Support & Documentation
    { pattern: "help", type: "EXACT" as const, reason: "System use - help center" },
    { pattern: "support", type: "EXACT" as const, reason: "System use - support portal" },
    { pattern: "status", type: "EXACT" as const, reason: "System use - status page" },
    { pattern: "docs", type: "EXACT" as const, reason: "System use - documentation" },
    { pattern: "blog", type: "EXACT" as const, reason: "System use - blog" },

    // Account management
    { pattern: "signup", type: "EXACT" as const, reason: "System use - signup pages" },
    { pattern: "register", type: "EXACT" as const, reason: "System use - registration" },
    { pattern: "account", type: "EXACT" as const, reason: "System use - account management" },
    { pattern: "settings", type: "EXACT" as const, reason: "System use - settings pages" },
    { pattern: "billing", type: "EXACT" as const, reason: "System use - billing portal" },
    { pattern: "payment", type: "EXACT" as const, reason: "System use - payment pages" },
    { pattern: "checkout", type: "EXACT" as const, reason: "System use - checkout" },

    // Brand protection
    {
      pattern: "uplifter",
      type: "EXACT" as const,
      reason: "Brand protection - Uplifter trademark",
    },
    {
      pattern: "leapfrog",
      type: "EXACT" as const,
      reason: "Brand protection - LeapFrog trademark",
    },

    // Reserved words - exact matches
    { pattern: "test", type: "EXACT" as const, reason: "System use - reserved word" },
    { pattern: "demo", type: "EXACT" as const, reason: "System use - reserved word" },

    // Prefix reserved - blocks anything starting with pattern
    { pattern: "test-", type: "PREFIX" as const, reason: "System use - testing environments" },
    { pattern: "demo-", type: "PREFIX" as const, reason: "System use - demo environments" },
    { pattern: "staging-", type: "PREFIX" as const, reason: "System use - staging environments" },
    { pattern: "dev-", type: "PREFIX" as const, reason: "System use - development environments" },
  ];
  for (const rd of reservedDomainData) {
    await prisma.reservedDomain.upsert({
      where: { pattern: rd.pattern },
      update: {},
      create: rd,
    });
  }
  console.log(`  ✓ Created ${reservedDomainData.length} reserved domains`);

  // ============================================
  // EMAIL CAMPAIGNS & USAGE
  // ============================================
  console.log("\n📧 Creating email campaigns and usage...");

  // Get the current billing period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Create email usage records for both orgs
  await prisma.emailUsage.upsert({
    where: {
      organizationId_periodStart: {
        organizationId: ORG1_ID,
        periodStart: periodStart,
      },
    },
    update: {},
    create: {
      organizationId: ORG1_ID,
      periodStart: periodStart,
      periodEnd: periodEnd,
      emailsSent: 156,
      emailsDelivered: 152,
      emailsOpened: 89,
      emailsClicked: 34,
      emailsBounced: 3,
      emailsComplained: 0,
      emailsFailed: 1,
      includedEmails: 2500,
      overageEmails: 0,
      overageCost: 0,
    },
  });

  // Sample email campaigns for Sunrise Skating
  const sunriseCampaigns = [
    {
      id: "seed-email-campaign-1",
      organizationId: ORG1_ID,
      name: "January Newsletter",
      subject: "Happy New Year from Sunrise Skating! 🎉",
      htmlBody: `<h2>Happy New Year, Sunrise Family!</h2>
<p>We hope you had a wonderful holiday season. As we kick off 2026, we're excited to share what's coming up:</p>
<ul>
<li><strong>Winter Session</strong> begins January 13th</li>
<li><strong>Open Gym</strong> every Saturday 2-4pm</li>
<li><strong>Competition Team tryouts</strong> February 1st</li>
</ul>
<p>Don't forget to register early - spots fill up fast!</p>
<p>See you at the gym!</p>`,
      textBody: "Happy New Year from Sunrise Skating! Winter session begins January 13th.",
      classification: "NEWSLETTER" as const,
      status: "COMPLETED" as const,
      totalRecipients: 89,
      sentCount: 89,
      deliveredCount: 87,
      openedCount: 54,
      clickedCount: 23,
      bouncedCount: 2,
      complainedCount: 0,
      failedCount: 0,
      startedAt: daysAgo(15),
      completedAt: daysAgo(15),
      createdAt: daysAgo(16),
    },
    {
      id: "seed-email-campaign-2",
      organizationId: ORG1_ID,
      name: "Competition Team Update",
      subject: "Important: Regional Competition Details",
      htmlBody: `<h2>Regional Competition - February 15th</h2>
<p>Dear Competition Team Families,</p>
<p>Here are the details for the upcoming regional competition:</p>
<ul>
<li><strong>Date:</strong> Saturday, February 15th</li>
<li><strong>Location:</strong> Springfield Sports Center</li>
<li><strong>Check-in:</strong> 7:30 AM</li>
<li><strong>Competition starts:</strong> 9:00 AM</li>
</ul>
<p>Please make sure your athlete's competition leotard is ready. Let us know if you have any questions!</p>`,
      textBody:
        "Regional Competition - February 15th at Springfield Sports Center. Check-in at 7:30 AM.",
      classification: "EVENT_UPDATE" as const,
      targetProgramId: `${ORG1_ID}-prog-jo`, // JO Competition Team
      status: "COMPLETED" as const,
      totalRecipients: 24,
      sentCount: 24,
      deliveredCount: 24,
      openedCount: 22,
      clickedCount: 8,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      startedAt: daysAgo(5),
      completedAt: daysAgo(5),
      createdAt: daysAgo(6),
    },
    {
      id: "seed-email-campaign-3",
      organizationId: ORG1_ID,
      name: "Spring Registration Reminder",
      subject: "Spring Session Registration Now Open!",
      htmlBody: `<h2>Spring Session Registration</h2>
<p>Registration for our Spring session is now open!</p>
<p><strong>Spring Session Dates:</strong> March 10 - May 30</p>
<p>Current families get priority registration through February 1st. After that, registration opens to the public.</p>
<p>New this spring:</p>
<ul>
<li>Tumbling & Trampoline class (Ages 8-12)</li>
<li>Parent & Tot sessions on Wednesdays</li>
<li>Extended summer camp options</li>
</ul>
<p>Register now to secure your spot!</p>`,
      textBody:
        "Spring Session Registration is now open! March 10 - May 30. Register now to secure your spot.",
      classification: "PROGRAM_UPDATE" as const,
      status: "SCHEDULED" as const,
      totalRecipients: 89,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      scheduledAt: daysFromNow(2),
      createdAt: daysAgo(1),
    },
    {
      id: "seed-email-campaign-4",
      organizationId: ORG1_ID,
      name: "Membership Renewal",
      subject: "Your Annual Membership is Expiring Soon",
      htmlBody: `<h2>Membership Renewal Reminder</h2>
<p>Your annual membership at Sunrise Skating is expiring soon.</p>
<p>Renew before the end of the month to:</p>
<ul>
<li>Lock in current rates</li>
<li>Get priority class registration</li>
<li>Receive 10% off summer camps</li>
</ul>
<p>Thank you for being part of our skating family!</p>`,
      textBody:
        "Your annual membership is expiring soon. Renew before the end of the month to lock in current rates.",
      classification: "MEMBERSHIP" as const,
      targetMembershipStatus: "EXPIRED",
      status: "DRAFT" as const,
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      createdAt: daysAgo(1),
    },
  ];

  for (const campaign of sunriseCampaigns) {
    await prisma.emailCampaign.upsert({
      where: { id: campaign.id },
      update: {},
      create: campaign,
    });
  }
  console.log(`  ✓ Created ${sunriseCampaigns.length} email campaigns for Sunrise Skating`);

  // ============================================
  // NOTIFICATION RULES
  // ============================================
  console.log("\n🔔 Creating notification rules...");

  // Helper function to create notification rules with templates
  const createNotificationRule = async (data: {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    triggerType: string;
    timingValue: number;
    timingUnit: string;
    timingDirection: string;
    actionType: string;
    isSystem: boolean;
    subject?: string;
    body: string;
    smsBody?: string;
    recipientType: string;
  }) => {
    const rule = await prisma.notificationRule.upsert({
      where: { id: data.id },
      update: {},
      create: {
        id: data.id,
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType as any,
        timingValue: data.timingValue,
        timingUnit: data.timingUnit as any,
        timingDirection: data.timingDirection as any,
        actionType: data.actionType as any,
        isSystem: data.isSystem,
        isActive: true,
      },
    });

    // Create template
    await prisma.notificationTemplate.upsert({
      where: { notificationRuleId: rule.id },
      update: {},
      create: {
        notificationRuleId: rule.id,
        subject: data.subject,
        body: data.body,
        smsBody: data.smsBody,
      },
    });

    // Create recipient config
    await prisma.notificationRecipientConfig.upsert({
      where: { notificationRuleId: rule.id },
      update: {},
      create: {
        notificationRuleId: rule.id,
        recipientType: data.recipientType as any,
        filters: {},
      },
    });

    return rule;
  };

  // System notification rules for Sunrise Skating
  const sunriseNotificationRules = [
    {
      id: `${ORG1_ID}-notif-payment-reminder`,
      organizationId: ORG1_ID,
      name: "Payment Reminder",
      description: "Reminder sent 3 days before payment is due",
      triggerType: "PAYMENT_DUE",
      timingValue: 3,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Payment Reminder - {{invoiceReference}}",
      body: `Dear {{guardianName}},

This is a friendly reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is due on {{dueDate}}.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Due Date: {{dueDate}}

To make a payment, please visit: {{paymentUrl}}

If you have already made this payment, please disregard this notice.

Thank you,
{{organizationName}}`,
      smsBody: `{{organizationName}}: Payment of {{invoiceAmount}} ({{invoiceReference}}) is due {{dueDate}}. Pay now: {{paymentUrl}}`,
      recipientType: "GUARDIANS",
    },
    {
      id: `${ORG1_ID}-notif-payment-urgent`,
      organizationId: ORG1_ID,
      name: "Payment Reminder Urgent",
      description: "Urgent reminder sent 1 day after payment is overdue",
      triggerType: "PAYMENT_OVERDUE",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "EMAIL",
      isSystem: true,
      subject: "URGENT: Payment Overdue - {{invoiceReference}}",
      body: `Dear {{guardianName}},

This is an urgent reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is now overdue.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Original Due Date: {{dueDate}}

Please make payment immediately to avoid any service interruptions: {{paymentUrl}}

If you need to discuss payment options, please contact us at {{organizationEmail}}.

Thank you,
{{organizationName}}`,
      smsBody: `URGENT from {{organizationName}}: Payment of {{invoiceAmount}} is overdue. Please pay now: {{paymentUrl}}`,
      recipientType: "GUARDIANS",
    },
    {
      id: `${ORG1_ID}-notif-membership-warning`,
      organizationId: ORG1_ID,
      name: "Membership Expiry Warning",
      description: "Warning sent 7 days before membership expires",
      triggerType: "MEMBERSHIP_EXPIRY",
      timingValue: 7,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Your Membership is Expiring Soon - {{athleteName}}",
      body: `Dear {{guardianName}},

This is a reminder that {{athleteName}}'s {{membershipName}} will expire on {{membershipEndDate}}.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expiration Date: {{membershipEndDate}}
Days Remaining: {{membershipDaysRemaining}}

To ensure uninterrupted participation in classes and events, please renew the membership before it expires.

If you have any questions, please contact us at {{organizationEmail}}.

Thank you for being part of the Sunrise Skating family!
{{organizationName}}`,
      smsBody: `{{organizationName}}: {{athleteName}}'s {{membershipName}} expires {{membershipEndDate}}. Please renew to continue participation.`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG1_ID}-notif-membership-urgent`,
      organizationId: ORG1_ID,
      name: "Membership Expiry Urgent",
      description: "Urgent notice sent 1 day after membership expires",
      triggerType: "MEMBERSHIP_EXPIRED",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "EMAIL",
      isSystem: true,
      subject: "URGENT: Membership Expired - {{athleteName}}",
      body: `Dear {{guardianName}},

This is an urgent notice that {{athleteName}}'s {{membershipName}} has expired.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expired On: {{membershipEndDate}}

{{athleteName}} will not be able to participate in programs until the membership is renewed.

Please renew as soon as possible to avoid any disruption. Contact us at {{organizationEmail}} if you need assistance.

Thank you,
{{organizationName}}`,
      smsBody: `URGENT from {{organizationName}}: {{athleteName}}'s membership has EXPIRED. Please renew immediately to continue participation.`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG1_ID}-notif-program-reminder`,
      organizationId: ORG1_ID,
      name: "Program Reminder",
      description: "Reminder sent 1 day before class/event",
      triggerType: "PROGRAM_REMINDER",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Reminder: {{programName}} Tomorrow - {{eventDate}}",
      body: `Dear {{guardianName}},

This is a reminder that {{athleteName}} has {{programName}} tomorrow.

Program: {{programName}}
Date: {{eventDate}}
Time: {{eventTime}}
Location: {{eventLocation}}

Please ensure {{athleteFirstName}} arrives on time and has all necessary equipment (leotard, water bottle, hair tied back).

See you at the gym!
{{organizationName}}`,
      smsBody: `{{organizationName}}: Reminder - {{athleteFirstName}} has {{programName}} on {{eventDate}} at {{eventTime}}.`,
      recipientType: "GUARDIANS",
    },
    // Custom notification for Sunrise
    {
      id: `${ORG1_ID}-notif-birthday`,
      organizationId: ORG1_ID,
      name: "Birthday Wishes",
      description: "Birthday greeting sent on athlete's birthday",
      triggerType: "BIRTHDAY",
      timingValue: 0,
      timingUnit: "DAYS",
      timingDirection: "AT",
      actionType: "EMAIL",
      isSystem: false,
      subject: "Happy Birthday, {{athleteFirstName}}! 🎂",
      body: `Dear {{guardianName}},

Happy Birthday to {{athleteName}}! 🎉

Everyone at Sunrise Skating wishes {{athleteFirstName}} a wonderful birthday filled with flips, tumbles, and lots of fun!

As a special birthday treat, {{athleteFirstName}} will receive a small gift at their next class.

Best wishes,
The Sunrise Skating Team
{{organizationName}}`,
      smsBody: `🎂 Happy Birthday, {{athleteFirstName}}! From your friends at {{organizationName}}!`,
      recipientType: "GUARDIANS",
    },
  ];

  for (const rule of sunriseNotificationRules) {
    await createNotificationRule(rule);
  }
  console.log(
    `  ✓ Created ${sunriseNotificationRules.length} notification rules for Sunrise Skating`
  );

  // Ensure all seeded orgs have the full set of system rules (including payout
  // trigger types added after initial seed data was written). Safe to re-run —
  // createSystemRulesForOrganization skips rules that already exist.
  for (const orgId of [ORG1_ID, ORG_DEMO_ID]) {
    const result = await createSystemRulesForOrganization(orgId);
    if (result.created > 0) {
      console.log(`  ✓ Created ${result.created} missing system rules for ${orgId}`);
    }
  }

  // ============================================
  // WAIVERS & DIGITAL SIGNATURES
  // ============================================
  console.log("\n📝 Creating waivers...");

  // Sunrise Skating Club - General Liability Waiver (2 pages)
  await prisma.waiver.upsert({
    where: { id: `${ORG1_ID}-waiver-liability` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability`,
      organizationId: ORG1_ID,
      title: "General Liability Waiver",
      status: "ACTIVE",
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-liability-p1` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability-p1`,
      waiverId: `${ORG1_ID}-waiver-liability`,
      pageNumber: 1,
      title: "Assumption of Risk & Release of Liability",
      content: `<h2>Assumption of Risk & Release of Liability</h2>
<p>I, the undersigned participant (or parent/guardian of a minor participant), acknowledge and agree to the following:</p>
<h3>1. Assumption of Risk</h3>
<p>I understand that participation in figure skating and related activities involves inherent risks of physical injury, including but not limited to sprains, fractures, concussions, paralysis, and in rare cases, death. I voluntarily assume all risks associated with participation in programs offered by Sunrise Skating Club.</p>
<h3>2. Release of Liability</h3>
<p>In consideration of being permitted to participate in programs, I hereby release, waive, and discharge Sunrise Skating Club, its owners, officers, employees, coaches, volunteers, and agents from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained during participation.</p>
<h3>3. Indemnification</h3>
<p>I agree to indemnify and hold harmless Sunrise Skating Club from any loss, liability, damage, or cost it may incur due to my (or my child's) participation in programs, whether caused by negligence or otherwise.</p>
<p><strong>I have read this Assumption of Risk & Release of Liability, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-liability-p2` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability-p2`,
      waiverId: `${ORG1_ID}-waiver-liability`,
      pageNumber: 2,
      title: "Medical Authorization & Emergency Contact",
      content: `<h2>Medical Authorization & Emergency Contact Consent</h2>
<h3>4. Medical Authorization</h3>
<p>In the event of an emergency, I authorize Sunrise Skating Club staff to seek and obtain emergency medical treatment for the participant. I understand that I will be responsible for the cost of any such treatment.</p>
<p>I certify that the participant is in good physical health and has no conditions that would prevent safe participation in figure skating activities, unless otherwise disclosed in writing to the Club.</p>
<h3>5. Emergency Contact Consent</h3>
<p>I consent to being contacted at the phone number and email address provided on my registration form in case of emergency. I understand that the Academy will make reasonable efforts to contact me before seeking emergency medical treatment.</p>
<h3>6. Photo/Video for Safety Documentation</h3>
<p>I understand that the Academy may use video monitoring for safety and coaching purposes within the facility. This footage is for internal use only and will not be shared publicly without separate consent.</p>
<p><strong>I have read this Medical Authorization & Emergency Contact Consent, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  // Sunrise Skating Club - Photo & Video Release (1 page)
  await prisma.waiver.upsert({
    where: { id: `${ORG1_ID}-waiver-photo` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-photo`,
      organizationId: ORG1_ID,
      title: "Photo & Video Release",
      status: "ACTIVE",
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-photo-p1` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-photo-p1`,
      waiverId: `${ORG1_ID}-waiver-photo`,
      pageNumber: 1,
      title: "Photo & Video Consent",
      content: `<h2>Photo & Video Release Consent</h2>
<p>I, the undersigned (or parent/guardian of a minor participant), hereby grant Sunrise Skating Club permission to:</p>
<ul>
<li>Take photographs and/or video recordings of the participant during programs, events, competitions, and activities.</li>
<li>Use such photographs and recordings for promotional purposes including but not limited to the Academy's website, social media channels, printed marketing materials, newsletters, and press releases.</li>
</ul>
<h3>Terms</h3>
<p>I understand that:</p>
<ul>
<li>No compensation will be provided for the use of these images or recordings.</li>
<li>The Academy will not use images in a manner that is harmful or defamatory.</li>
<li>I may revoke this consent at any time by providing written notice to the Academy, though images already published may not be retrievable.</li>
<li>This release is valid for the duration of the participant's enrollment at Sunrise Skating Club.</li>
</ul>
<p><strong>I have read this Photo & Video Release, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  // Attach waivers as program requirements
  // Sunrise: General Liability Waiver on the Bronze program
  await prisma.programWaiverRequirement.upsert({
    where: {
      programId_waiverId: {
        programId: `${ORG1_ID}-prog-rec-bronze`,
        waiverId: `${ORG1_ID}-waiver-liability`,
      },
    },
    update: {},
    create: {
      programId: `${ORG1_ID}-prog-rec-bronze`,
      waiverId: `${ORG1_ID}-waiver-liability`,
    },
  });

  // Update the program to have the waiver restriction flag
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-rec-bronze` },
    data: { hasWaiverRestriction: true },
  });

  console.log("  ✓ Created 2 Sunrise waivers with pages");
  console.log("  ✓ Attached waiver requirements to Bronze Learn to Skate");

  // ============================================
  // COMPETITIONS (Full examples with entries and results)
  // ============================================
  console.log("\n🏆 Creating competitions...");

  // --- Sunrise Skating: Spring Invitational (REGISTRATION_OPEN) ---
  const skatingCompetition = await prisma.competition.upsert({
    where: { id: `${ORG1_ID}-comp-spring-inv` },
    update: {},
    create: {
      id: `${ORG1_ID}-comp-spring-inv`,
      organizationId: ORG1_ID,
      name: "Spring Invitational 2026",
      color: "#d946ef",
      categoryId: `${ORG1_ID}-cat-competitive`,
      status: "REGISTRATION_OPEN",
      facilityId: `${ORG1_ID}-facility-main`,
      country: "US",
      stateProvince: "CA",
      city: "San Mateo",
      streetAddress: "100 Ice Rink Way",
      startDate: daysFromNow(45),
      endDate: daysFromNow(46),
      startTime: "08:00",
      endTime: "18:00",
      categoryMode: "SPECIFIC",
      hasAgeRestriction: true,
      minAge: 6,
      maxAge: 18,
      hasMembershipRestriction: true,
      membershipRequirementIds: [`${ORG1_ID}-mi-2026`],
      publishStatus: "LIVE",
    },
  });

  // Competition categories for skating: Free Skate (U10), Moves (U10), Short Program (U12)
  const skatingCompCats = [
    {
      id: `${ORG1_ID}-compcat-free-skate-u10`,
      competitionId: skatingCompetition.id,
      combinationEntryId: "combo-skate-cav-skate-u10-cav-skate-free-skate",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: true,
      submissionMode: "MANUAL_ENTRY" as const,
      qualifyingMark: 7.0,
      displayOrder: 0,
    },
    {
      id: `${ORG1_ID}-compcat-moves-u10`,
      competitionId: skatingCompetition.id,
      combinationEntryId: "combo-skate-cav-skate-u10-cav-skate-moves",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: false,
      submissionMode: "NONE" as const,
      displayOrder: 1,
    },
    {
      id: `${ORG1_ID}-compcat-short-program-u12`,
      competitionId: skatingCompetition.id,
      combinationEntryId: "combo-skate-cav-skate-u12-cav-skate-short-program",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: true,
      submissionMode: "MANUAL_ENTRY" as const,
      qualifyingMark: 6.5,
      displayOrder: 2,
    },
  ];

  for (const cat of skatingCompCats) {
    await prisma.competitionCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // Entries for skating competition
  const skatingCompEntries = [
    {
      id: `${ORG1_ID}-compentry-1`,
      competitionId: skatingCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-free-skate-u10`,
      athleteId: `${ORG1_ID}-ath-1`,
      status: "APPROVED" as const,
      seedPoints: 8.25,
      seedMarkSubmittedAt: daysAgo(10),
      seedMarkStatus: "APPROVED" as const,
    },
    {
      id: `${ORG1_ID}-compentry-2`,
      competitionId: skatingCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-free-skate-u10`,
      athleteId: `${ORG1_ID}-ath-2`,
      status: "PENDING_REVIEW" as const,
      seedPoints: 7.1,
      seedMarkSubmittedAt: daysAgo(5),
      seedMarkStatus: "PENDING" as const,
    },
    {
      id: `${ORG1_ID}-compentry-3`,
      competitionId: skatingCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-moves-u10`,
      athleteId: `${ORG1_ID}-ath-1`,
      status: "APPROVED" as const,
    },
    {
      id: `${ORG1_ID}-compentry-4`,
      competitionId: skatingCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-short-program-u12`,
      athleteId: `${ORG1_ID}-ath-3`,
      status: "PENDING_SEED" as const,
    },
  ];

  for (const entry of skatingCompEntries) {
    await prisma.competitionEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }
  console.log("  ✓ Created Sunrise Skating 'Spring Invitational 2026' (REGISTRATION_OPEN)");

  // --- Canonical skating taxonomy (CanSkate / STARSkate / Adult / Synchro) ---
  console.log("\n⛸️  Seeding skating taxonomy for Sunrise Skating and Demo Skating Club...");
  await seedSkatingTaxonomy(prisma, ORG1_ID);
  await seedSkatingTaxonomy(prisma, ORG_DEMO_ID);
  console.log(
    `  ✓ Created ${SKATE_SEED_COUNTS.categories} categories, ${SKATE_SEED_COUNTS.levels} levels, ${SKATE_SEED_COUNTS.skills} skating skills, ${SKATE_SEED_COUNTS.starSkills} STAR elements, ${SKATE_SEED_COUNTS.starTemplates} STAR test sheets per org`
  );

  // --- Skate Canada season (global, single active season) ---
  console.log("\n📅  Seeding Skate Canada season (2026-2027)...");
  await seedSkateCanadaSeasons(prisma);
  console.log("  ✓ Active SkateCanadaSeason '2026-2027' upserted");

  // --- Sample earned CanSkate ribbons for demo ---
  // ath-1 has earned Pre-CanSkate + Stage 1 (all 3 ribbons). ath-5 has earned
  // Pre-CanSkate + Stages 1-3 (9 ribbons + Pre-CanSkate). Other Sunrise
  // athletes are left blank to demonstrate the unearned state.
  const sampleRibbonAwards: Array<{ athleteId: string; ribbonKey: string; daysAgoEarned: number }> =
    [
      { athleteId: `${ORG1_ID}-ath-1`, ribbonKey: "pre-canskate-achievement", daysAgoEarned: 120 },
      { athleteId: `${ORG1_ID}-ath-1`, ribbonKey: "canskate-stage-1-balance", daysAgoEarned: 90 },
      { athleteId: `${ORG1_ID}-ath-1`, ribbonKey: "canskate-stage-1-control", daysAgoEarned: 75 },
      { athleteId: `${ORG1_ID}-ath-1`, ribbonKey: "canskate-stage-1-agility", daysAgoEarned: 60 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "pre-canskate-achievement", daysAgoEarned: 365 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-1-balance", daysAgoEarned: 300 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-1-control", daysAgoEarned: 290 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-1-agility", daysAgoEarned: 280 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-2-balance", daysAgoEarned: 200 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-2-control", daysAgoEarned: 195 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-2-agility", daysAgoEarned: 180 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-3-balance", daysAgoEarned: 90 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-3-control", daysAgoEarned: 60 },
      { athleteId: `${ORG1_ID}-ath-5`, ribbonKey: "canskate-stage-3-agility", daysAgoEarned: 30 },
    ];
  for (const award of sampleRibbonAwards) {
    const achievementId = `${ORG1_ID}-canskate-ach-${award.ribbonKey}`;
    await prisma.athleteAchievement.upsert({
      where: {
        athleteId_achievementId: {
          athleteId: award.athleteId,
          achievementId,
        },
      },
      update: {},
      create: {
        athleteId: award.athleteId,
        achievementId,
        earnedAt: daysAgo(award.daysAgoEarned),
      },
    });
  }
  console.log(`  ✓ Awarded ${sampleRibbonAwards.length} sample CanSkate ribbons`);

  // ============================================
  // COMPLETE
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Development seed completed successfully!");
  console.log("=".repeat(50));
  console.log("\nCreated data summary:");
  console.log("  • 3 organizations (Sunrise Skating, Demo Skating, Uplifter)");
  console.log("  • 4 subscription plans");
  console.log("  • 32 athletics events, 8 age categories, ~210 eligibility entries");
  console.log("  • 11 users with permissions");
  console.log("  • 9 families with payment methods");
  console.log("  • 14 athletes with guardian relationships");
  console.log("  • 9 programs with membership tiers");
  console.log("  • 12 program staff assignments (coaches)");
  console.log("  • 3 programs with membership requirements");
  console.log("  • 33+ events with 64+ attendance records (historical + current)");
  console.log("  • 5 invoices with line items and payments");
  console.log("  • Adyen transactions + payouts synced from live TEST environment (if configured)");
  console.log("  • 7 recurring charges");
  console.log("  • 34 figure skating skills with difficulty levels and age ranges");
  console.log("  • 6 evaluation templates with skill groupings");
  console.log("  • 5 evaluations with skill attempt statuses");
  console.log("  • 17 athlete skill progress records");
  console.log("  • Lesson plans");
  console.log("  • 7 POS products with stock movements");
  console.log("  • 6 media items (photos/videos)");
  console.log("  • 5 staff profiles with availability");
  console.log("  • 10 shifts (historical + scheduled)");
  console.log("  • 2 schedule templates with entries");
  console.log("  • 10 event staff assignments");
  console.log("  • 2 medical form configs with custom questions");
  console.log("  • 6 athlete medical info records with responses");
  console.log("  • 14 reserved domains");
  console.log("  • 4 email campaigns (newsletters, program updates, scheduled)");
  console.log("  • Email usage tracking for Sunrise Skating");
  console.log("  • 6 notification rules (system + custom for Sunrise)");
  console.log("  • 2 waivers with pages (Sunrise) + program requirements");
  console.log("  • 1 competition (figure skating REGISTRATION_OPEN)");
  console.log("  • 3 competition categories with result type/seed mark config");
  console.log("  • 4 competition entries (approved, pending review, pending seed)");
  console.log("  • 90 days of visitor analytics (if Redis configured)");
  console.log("\nTest accounts (use email-based login — no passwords set):");
  console.log("  Sunrise Skating Admin: admin@sunrise-skating.com");
  console.log("  Demo Skating Admin: admin@demo.com");
  console.log("  Demo Skating Coach: coach@demo.com");
  console.log("  Superadmin: andrewkarzel@uplifterinc.com");
  console.log("  Superadmin: drew.williams@uplifterinc.com");
  console.log("  Superadmin: okechi.onyeje@uplifterinc.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
