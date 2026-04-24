import { db } from "@/lib/db";
import {
  createStore,
  getStoreByReference,
  createSweep,
  getLegalEntity,
  createPlatformSplitConfiguration,
  attachSplitConfigurationToStore,
} from "@/lib/adyen-platform";

export type FinalizeOnboardingResult = {
  storeId: string | null;
  storeReference: string | null;
  sweepId: string | null;
};

/**
 * Core finalization logic: creates the Adyen split configuration, store, and sweep for an org.
 * Idempotent — safe to call multiple times; skips already-completed steps.
 *
 * Throws errors with a `code` property for the caller to map to HTTP status codes:
 *   "NOT_FOUND"    → 404
 *   "PRECONDITION" → 400
 *   "CONFIG_ERROR" → 500
 */
export async function finalizeOrgOnboarding(orgId: string): Promise<FinalizeOnboardingResult> {
  let account = await db.adyenPlatformAccount.findUnique({
    where: { organizationId: orgId, accountStatus: "ACTIVE" },
  });

  if (!account) throw finalizeError("Onboarding not started", "NOT_FOUND");
  if (account.onboardingStatus !== "VERIFIED")
    throw finalizeError(
      `Cannot finalize: current status is ${account.onboardingStatus}`,
      "PRECONDITION"
    );

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      slug: true,
      street: true,
      city: true,
      stateProvince: true,
      postalCode: true,
      country: true,
      phone: true,
      subscription: {
        select: {
          plan: {
            select: { transactionFee: true, perTransactionFee: true },
          },
        },
      },
    },
  });

  if (!org) throw finalizeError("Organization not found", "NOT_FOUND");

  const plan = org.subscription?.plan ?? null;
  // Intentional: split configuration requires real fee rates, so trial/free orgs without
  // an active plan cannot finalize until a subscription with fee values is in place.
  if (!plan)
    throw finalizeError(
      "No active subscription plan found. A plan is required to configure payment commission routing.",
      "PRECONDITION"
    );
  if (plan.transactionFee == null || plan.perTransactionFee == null)
    throw finalizeError("Subscription plan is missing fee configuration.", "PRECONDITION");

  const merchantId = process.env.ADYEN_PLATFORM_MERCHANT_ACCOUNT;
  if (!merchantId)
    throw finalizeError(
      "Platform configuration error: ADYEN_PLATFORM_MERCHANT_ACCOUNT is not set.",
      "CONFIG_ERROR"
    );

  const transactionFeeBasisPoints = plan.transactionFee.mul(10_000).toDecimalPlaces(0).toNumber();
  const perTransactionFeeMinorUnits = plan.perTransactionFee.mul(100).toDecimalPlaces(0).toNumber();

  if (!account.balanceAccountId)
    throw finalizeError(
      "Cannot configure payment splits: organization balance account is not yet set up.",
      "PRECONDITION"
    );

  // ── Split configuration (idempotent) ──────────────────────────────────────

  if (!account.splitConfigurationId) {
    // Optimistic re-fetch to close the race window before the Adyen call.
    const latest = await db.adyenPlatformAccount.findUnique({
      where: { id: account.id },
      select: { splitConfigurationId: true },
    });
    if (latest?.splitConfigurationId) {
      account = { ...account, splitConfigurationId: latest.splitConfigurationId };
    } else {
      const splitConfigId = await createPlatformSplitConfiguration({
        merchantId,
        description: `${org.name} — platform commission`,
        transactionFeeBasisPoints,
        perTransactionFeeMinorUnits,
      });

      // Atomic write — if a concurrent request still beat us, use their value.
      const updated = await db.adyenPlatformAccount.updateMany({
        where: {
          organizationId: orgId,
          id: account.id,
          accountStatus: "ACTIVE",
          splitConfigurationId: null,
        },
        data: { splitConfigurationId: splitConfigId },
      });
      if (updated.count === 0) {
        const fresh = await db.adyenPlatformAccount.findUnique({ where: { id: account.id } });
        if (!fresh?.splitConfigurationId)
          throw new Error("Failed to persist split configuration ID");
        account = { ...account, splitConfigurationId: fresh.splitConfigurationId };
      } else {
        account = { ...account, splitConfigurationId: splitConfigId };
      }
    }
  }

  const updates: {
    storeId?: string;
    storeReference?: string;
    sweepId?: string;
    transferInstrumentId?: string;
    payoutSchedule?: string;
  } = {};

  // ── Store (idempotent) ────────────────────────────────────────────────────

  if (!account.storeId) {
    if (!org.phone)
      throw finalizeError(
        "Organization phone number is missing. Please update your organization details before finalizing setup.",
        "PRECONDITION"
      );

    let formattedPhone = org.phone;
    const cleaned = org.phone.replace(/[^\d+]/g, "");
    const withCountryCode = !cleaned.startsWith("+")
      ? cleaned.length === 11 && cleaned.startsWith("1")
        ? `+${cleaned}`
        : `+1${cleaned}`
      : cleaned;

    if (withCountryCode.length >= 10) {
      formattedPhone = withCountryCode;
    } else {
      throw finalizeError(
        "Organization phone number is invalid. Please provide a valid phone number.",
        "PRECONDITION"
      );
    }

    const sanitizedName = org.name
      .replace(/[^a-zA-Z0-9\s&,.\-_@]/g, "")
      .substring(0, 22)
      .trim();

    const storeReference = `store-${org.slug}`;
    let store: { id: string; reference: string; [key: string]: any };

    try {
      store = await createStore({
        merchantId,
        description: org.name,
        shopperStatement: sanitizedName || "ClubRegistration",
        reference: storeReference,
        address: {
          country: org.country || "US",
          line1: org.street || "",
          city: org.city || "",
          stateOrProvince: org.stateProvince || "",
          postalCode: org.postalCode || "",
        },
        phoneNumber: formattedPhone,
        splitConfiguration: {
          splitConfigurationId: account.splitConfigurationId as string,
          balanceAccountId: account.balanceAccountId as string,
        },
      });
    } catch (error: any) {
      if (error.statusCode === 400 && error.responseBody?.includes("Store already exists")) {
        const existing = await getStoreByReference(merchantId, storeReference);
        if (!existing) throw error;

        if (!existing.splitConfiguration?.splitConfigurationId && account.splitConfigurationId) {
          try {
            await attachSplitConfigurationToStore(
              merchantId,
              existing.id,
              account.splitConfigurationId,
              account.balanceAccountId as string
            );
          } catch (attachError: any) {
            throw finalizeError(
              "Store was recovered but split configuration could not be attached. Please retry finalization.",
              "CONFIG_ERROR"
            );
          }
        }

        store = existing;
      } else {
        throw error;
      }
    }

    updates.storeId = store.id;
    updates.storeReference = store.reference;
  }

  // ── Sweep (idempotent) ────────────────────────────────────────────────────

  if (!account.sweepId && account.balanceAccountId && account.legalEntityId) {
    const transferInstrumentId = await findTransferInstrumentId(account.legalEntityId);

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

        updates.sweepId = sweep.id;
        updates.transferInstrumentId = transferInstrumentId;
        updates.payoutSchedule = "daily";
      } catch (error: any) {
        const existingSweepId = error.apiError?.detail?.match(/already exists: \(([^)]+)\)/)?.[1];
        if (error.statusCode === 422 && existingSweepId) {
          updates.sweepId = existingSweepId;
          updates.transferInstrumentId = transferInstrumentId;
          updates.payoutSchedule = "daily";
        } else {
          throw error;
        }
      }
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.adyenPlatformAccount.update({
      where: { organizationId: orgId, id: account.id, accountStatus: "ACTIVE" },
      data: updates,
    });
  }

  return {
    storeId: updates.storeId ?? account.storeId,
    storeReference: updates.storeReference ?? account.storeReference,
    sweepId: updates.sweepId ?? account.sweepId ?? null,
  };
}

function finalizeError(message: string, code: "NOT_FOUND" | "PRECONDITION" | "CONFIG_ERROR") {
  return Object.assign(new Error(message), { code });
}

async function findTransferInstrumentId(legalEntityId: string): Promise<string | null> {
  try {
    const entity = await getLegalEntity(legalEntityId);
    const instruments: Array<{ id: string }> = entity.transferInstruments || [];
    return instruments[0]?.id ?? null;
  } catch {
    console.error(
      "adyen-onboarding-finalize: failed to look up transfer instrument",
      legalEntityId
    );
    return null;
  }
}
