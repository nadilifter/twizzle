import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createLegalEntity,
  createBusinessLine,
  createAccountHolder,
  createBalanceAccount,
  getAccountHolder,
  getLegalEntity,
  createSweep,
  getSweepSchedule,
  isPlatformConfigured,
} from "@/lib/adyen-platform";
import { deriveOnboardingStatus, summarizeVerification } from "@/lib/adyen-onboarding-status";
import { handleVerificationRecovery } from "@/lib/adyen-onboarding-recovery";
import { getSubdomainUrl } from "@/lib/env-domains";

/**
 * Extract human-readable verification errors from the capabilities object.
 * Returns a flat list of { capability, code, message } so the dashboard can
 * show exactly what the user needs to fix and prompt them to re-enter onboarding.
 */
function extractCapabilityProblems(
  capabilities: any
): { capability: string; code: string; message: string }[] {
  if (!capabilities || typeof capabilities !== "object") return [];
  const problems: { capability: string; code: string; message: string }[] = [];
  for (const [capability, details] of Object.entries(capabilities as Record<string, any>)) {
    for (const problem of details?.problems ?? []) {
      for (const err of problem?.verificationErrors ?? []) {
        problems.push({ capability, code: err.code ?? "", message: err.message ?? "" });
      }
    }
  }
  return problems;
}

/**
 * GET /api/organization/adyen-onboarding
 * Returns the current organization's Adyen platform onboarding status.
 */
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orgId = session.user.organizationId;
    let account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId, accountStatus: "ACTIVE" },
    });

    // Live-sync: if the account exists and isn't already terminal, reconcile
    // with Adyen's API so the status is accurate even without webhooks.
    const skipLiveSync =
      process.env.NODE_ENV !== "production" && process.env.SKIP_ADYEN_LIVE_SYNC === "true";

    if (!skipLiveSync && account?.accountHolderId && isPlatformConfigured()) {
      try {
        const liveHolder = await getAccountHolder(account.accountHolderId);
        const onboardingStatus = deriveOnboardingStatus(liveHolder);
        const verificationStatus = summarizeVerification(liveHolder);
        const capabilities = liveHolder.capabilities || {};

        const isRecovery =
          onboardingStatus === "VERIFIED" &&
          account.onboardingStatus !== "VERIFIED" &&
          !!account.verifiedAt;

        if (
          onboardingStatus !== account.onboardingStatus ||
          JSON.stringify(capabilities) !== JSON.stringify(account.capabilities)
        ) {
          const syncUpdate: Record<string, any> = {
            onboardingStatus,
            verificationStatus,
            capabilities,
          };
          if (onboardingStatus === "VERIFIED" && !account.verifiedAt) {
            syncUpdate.verifiedAt = new Date();
          }
          account = await db.adyenPlatformAccount.update({
            where: { organizationId: orgId, id: account.id },
            data: syncUpdate,
          });
        }

        if (isRecovery) {
          await handleVerificationRecovery(account);
        }
      } catch {
        // Best-effort: if Adyen API is unreachable, fall back to stored status
      }
    }

    // Live-sync sweep: if VERIFIED but sweep missing, check Adyen for a transfer instrument
    // and auto-create the sweep. Covers the case where a bank account was added via hosted
    // onboarding after the initial finalize call.
    if (
      !skipLiveSync &&
      account?.onboardingStatus === "VERIFIED" &&
      !account.sweepId &&
      account.balanceAccountId &&
      account.legalEntityId &&
      isPlatformConfigured()
    ) {
      try {
        const entity = await getLegalEntity(account.legalEntityId);
        const instruments: Array<{ id: string }> = entity.transferInstruments || [];
        const transferInstrumentId = instruments[0]?.id ?? null;

        if (transferInstrumentId) {
          try {
            const sweep = await createSweep(account.balanceAccountId, {
              counterparty: { transferInstrumentId },
              category: "bank",
              type: "push",
              schedule: { type: "daily" },
              priorities: ["regular"],
              currency: "USD",
            });
            account = await db.adyenPlatformAccount.update({
              where: { organizationId: orgId, id: account.id },
              data: { sweepId: sweep.id, transferInstrumentId, payoutSchedule: "daily" },
            });
          } catch (sweepError: any) {
            // 422 means sweep already exists in Adyen but DB wasn't updated — recover the ID
            const existingSweepId = sweepError.apiError?.detail?.match(
              /already exists: \(([^)]+)\)/
            )?.[1];
            if (sweepError.statusCode === 422 && existingSweepId) {
              // Don't hardcode payoutSchedule here — Adyen owns the actual schedule
              // for the recovered sweep, and the read-through block below will
              // reconcile it.
              account = await db.adyenPlatformAccount.update({
                where: { organizationId: orgId, id: account.id },
                data: { sweepId: existingSweepId, transferInstrumentId },
              });
            }
          }
        }
      } catch {
        // Best-effort: if Adyen API is unreachable, fall back to stored state
      }
    }

    // Live-sync payout schedule: Adyen owns the canonical sweep schedule, our
    // payoutSchedule column is just a cache. After db:reset/seed (or an
    // out-of-band schedule edit in Adyen Customer Area) the cache drifts, so
    // reconcile from Adyen on read and self-heal the DB when it differs.
    if (!skipLiveSync && account?.sweepId && account.balanceAccountId && isPlatformConfigured()) {
      const adyenSchedule = await getSweepSchedule(account.balanceAccountId, account.sweepId);
      if (adyenSchedule && adyenSchedule !== account.payoutSchedule) {
        account = await db.adyenPlatformAccount.update({
          where: { organizationId: orgId, id: account.id },
          data: { payoutSchedule: adyenSchedule },
        });
      }
    }

    const org = await db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: {
        id: true,
        name: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        phone: true,
        taxRate: true,
        taxEnabled: true,
        onboardingLegalNameConfirmedAt: true,
        onboardingFeeAcknowledgedAt: true,
        onboardingAgreementAcceptedAt: true,
        subscription: {
          select: {
            plan: {
              select: {
                transactionFee: true,
                perTransactionFee: true,
              },
            },
          },
        },
      },
    });

    const activePlan = org?.subscription?.plan ?? null;

    if (!activePlan) {
      return NextResponse.json(
        { error: "No active plan found for this organization." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      organization: org,
      plan: activePlan
        ? {
            transactionFee: activePlan.transactionFee,
            perTransactionFee: activePlan.perTransactionFee,
          }
        : null,
      account: account
        ? {
            onboardingStatus: account.onboardingStatus,
            verificationStatus: account.verificationStatus,
            capabilities: account.capabilities,
            capabilityProblems: extractCapabilityProblems(account.capabilities),
            hasStore: !!account.storeId,
            hasSweep: !!account.sweepId,
            payoutSchedule: account.payoutSchedule,
            legalEntityId: account.legalEntityId,
            accountHolderId: account.accountHolderId,
            balanceAccountId: account.balanceAccountId,
            verifiedAt: account.verifiedAt?.toISOString() ?? null,
            transferInstrumentId: account.transferInstrumentId ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error("Failed to fetch onboarding status:", error);
    return NextResponse.json({ error: "Failed to fetch onboarding status" }, { status: 500 });
  }
}

/**
 * POST /api/organization/adyen-onboarding
 * Initiates Adyen platform onboarding: creates Legal Entity, Business Line,
 * Account Holder, and Balance Account.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!isPlatformConfigured()) {
      return NextResponse.json({ error: "Adyen platform is not configured" }, { status: 503 });
    }

    const orgId = session.user.organizationId;

    // Check if already onboarded
    const existing = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId, accountStatus: "ACTIVE" },
    });
    if (existing) {
      return NextResponse.json({
        account: {
          onboardingStatus: existing.onboardingStatus,
          verificationStatus: existing.verificationStatus,
          legalEntityId: existing.legalEntityId,
          accountHolderId: existing.accountHolderId,
          balanceAccountId: existing.balanceAccountId,
        },
        message: "Onboarding already initiated",
      });
    }

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        street: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        country: true,
        phone: true,
        email: true,
        websiteConfig: { select: { subdomain: true } },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (
      !org.street ||
      !org.city ||
      !org.stateProvince ||
      !org.postalCode ||
      !org.country ||
      !org.phone
    ) {
      return NextResponse.json(
        {
          error:
            "Organization address or phone number is incomplete. Please update your organization details before onboarding.",
        },
        { status: 400 }
      );
    }

    if (org.stateProvince.length > 2 || org.country.length > 2) {
      return NextResponse.json(
        {
          error:
            "State/Province and Country must be 2-letter codes. Please edit your organization address to fix this.",
        },
        { status: 400 }
      );
    }

    // Read gate confirmations and optional overrides from request body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // No body is fine
    }

    const { legalNameConfirmed, platformAgreementAccepted, platformFeeAcknowledged } = body;

    if (!legalNameConfirmed) {
      return NextResponse.json(
        { error: "Legal name must be confirmed before initiating onboarding." },
        { status: 400 }
      );
    }

    if (!platformAgreementAccepted) {
      return NextResponse.json(
        { error: "Terms of Service must be accepted before initiating onboarding." },
        { status: 400 }
      );
    }

    if (!platformFeeAcknowledged) {
      return NextResponse.json(
        { error: "Platform fee must be acknowledged before initiating onboarding." },
        { status: 400 }
      );
    }

    // Step 1: Create Legal Entity
    const legalEntity = await createLegalEntity({
      type: "organization",
      organization: {
        legalName: org.name,
        registeredAddress: {
          street: org.street,
          city: org.city,
          stateOrProvince: org.stateProvince,
          postalCode: org.postalCode,
          country: org.country,
        },
      },
    });

    // Step 2: Create Business Line — required for hosted onboarding and store compliance.
    // 422 duplicate means a business line already exists for this legal entity (e.g. a
    // prior partial attempt). Extract its ID and continue; throw on any other error.
    const subdomain = org.websiteConfig?.subdomain || org.slug;
    const webAddress = getSubdomainUrl(subdomain);
    let businessLine: { id: string } | null = null;
    try {
      businessLine = await createBusinessLine({
        legalEntityId: legalEntity.id,
        industryCode: body.industryCode || "4431A",
        service: "paymentProcessing",
        salesChannels: ["eCommerce"],
        webData: [{ webAddress }],
      });
    } catch (error: any) {
      const existingId = (() => {
        try {
          const parsed = JSON.parse(error.responseBody ?? "{}");
          return (
            (parsed.invalidFields ?? []).find(
              (f: any) => f.name === "ACQUIRING_BUSINESS_LINE" && f.message?.includes("duplicate")
            )?.value ?? null
          );
        } catch {
          return null;
        }
      })();
      if (error.statusCode === 422 && existingId) {
        businessLine = { id: existingId };
      } else {
        console.error("Business line creation failed", {
          legalEntityId: legalEntity.id,
          status: error.statusCode,
          body: error.responseBody,
        });
        throw error;
      }
    }

    // Step 3: Create Account Holder
    const accountHolder = await createAccountHolder({
      legalEntityId: legalEntity.id,
      description: org.name,
    });

    // Step 4: Create Balance Account
    const balanceAccount = await createBalanceAccount({
      accountHolderId: accountHolder.id,
      description: `${org.name} - Primary`,
    });

    // Save to database
    const now = new Date();
    const account = await db.adyenPlatformAccount.create({
      data: {
        organizationId: org.id,
        legalEntityId: legalEntity.id,
        businessLineId: businessLine?.id || null,
        accountHolderId: accountHolder.id,
        balanceAccountId: balanceAccount.id,
        onboardingStatus: "PENDING_HOSTED",
        legalNameConfirmedAt: now,
        platformAgreementAcceptedAt: now,
        platformFeeAcknowledgedAt: now,
      },
    });

    return NextResponse.json({
      account: {
        onboardingStatus: account.onboardingStatus,
        legalEntityId: account.legalEntityId,
        accountHolderId: account.accountHolderId,
        balanceAccountId: account.balanceAccountId,
        businessLineId: account.businessLineId,
      },
      message: "Onboarding initiated successfully",
    });
  } catch (error: any) {
    console.error("Onboarding initiation failed:", error);
    return NextResponse.json({ error: "Onboarding initiation failed" }, { status: 500 });
  }
}
