import { db } from "@/lib/db";
import { getSubdomainUrl } from "@/lib/env-domains";
import {
  createStore,
  getStoreByReference,
  createSweep,
  getLegalEntity,
  createPlatformSplitConfiguration,
  deletePlatformSplitConfiguration,
  attachSplitConfigurationToStore,
  addPaymentMethodsToStore,
  signPciForLegalEntity,
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
      websiteConfig: {
        select: { subdomain: true },
      },
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

  if (!account.businessLineId)
    throw finalizeError(
      "Cannot finalize: business line is missing from the platform account. Re-enter hosted onboarding to recover it.",
      "PRECONDITION"
    );

  const businessLineIds = [account.businessLineId];

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
        businessLineIds,
      });
    } catch (error: any) {
      if (error.statusCode === 400 && error.responseBody?.includes("Store already exists")) {
        const existing = await getStoreByReference(merchantId, storeReference);
        if (!existing) throw error;
        store = existing;
      } else {
        throw error;
      }
    }

    // Explicitly attach the split configuration after store creation or recovery.
    // createStoreByMerchantId accepts splitConfiguration in its payload but does not
    // reliably apply it — an explicit updateStore call is required in both paths.
    // Also handles the case where the store has a stale split config from a previous run
    // (e.g. dev DB reset with the Adyen store still intact).
    const staleSplitConfigId = store.splitConfiguration?.splitConfigurationId;
    if (account.splitConfigurationId && staleSplitConfigId !== account.splitConfigurationId) {
      try {
        await attachSplitConfigurationToStore(
          merchantId,
          store.id,
          account.splitConfigurationId,
          account.balanceAccountId as string,
          businessLineIds
        );
      } catch {
        throw finalizeError(
          "Store was created but split configuration could not be attached. Please retry finalization.",
          "CONFIG_ERROR"
        );
      }
      if (staleSplitConfigId) {
        await deletePlatformSplitConfiguration(merchantId, staleSplitConfigId).catch(() => {
          console.warn("adyen-onboarding-finalize: could not delete stale split configuration", {
            staleSplitConfigId,
          });
        });
      }
    }

    updates.storeId = store.id;
    updates.storeReference = store.reference;
  }

  // ── Split config on pre-existing store (idempotent) ───────────────────────
  // When storeId was already saved in the DB (store was created in a prior run
  // before split config existed, or creation happened outside finalize), check
  // whether the split config is attached and add it if missing.
  if (
    !updates.storeId &&
    account.storeId &&
    account.splitConfigurationId &&
    account.balanceAccountId
  ) {
    const existingStoreRef = account.storeReference ?? `store-${org.slug}`;
    const existingStore = await getStoreByReference(merchantId, existingStoreRef);
    const staleExistingConfigId = existingStore?.splitConfiguration?.splitConfigurationId;
    const existingBusinessLineIds: string[] = (existingStore as any)?.businessLineIds ?? [];
    const missingBusinessLine =
      businessLineIds.length > 0 &&
      !businessLineIds.every((id) => existingBusinessLineIds.includes(id));
    if (
      existingStore &&
      (staleExistingConfigId !== account.splitConfigurationId || missingBusinessLine)
    ) {
      try {
        await attachSplitConfigurationToStore(
          merchantId,
          account.storeId,
          account.splitConfigurationId,
          account.balanceAccountId,
          businessLineIds
        );
      } catch {
        throw finalizeError(
          "Existing store is missing split configuration and it could not be attached. Please retry finalization.",
          "CONFIG_ERROR"
        );
      }
      if (staleExistingConfigId && staleExistingConfigId !== account.splitConfigurationId) {
        await deletePlatformSplitConfiguration(merchantId, staleExistingConfigId).catch(() => {
          console.warn("adyen-onboarding-finalize: could not delete stale split configuration", {
            staleExistingConfigId,
          });
        });
      }
    }
  }

  // ── Payment methods (idempotent) ─────────────────────────────────────────
  // Runs for both newly created and pre-existing stores. addPaymentMethodsToStore
  // skips types already configured, so it's safe to call on every finalization.
  const storeIdForPaymentMethods = updates.storeId ?? account.storeId;
  if (storeIdForPaymentMethods) {
    const subdomain = org.websiteConfig?.subdomain || org.slug;
    const storeUrl = getSubdomainUrl(subdomain);
    // Apple Pay domain verification requires a valid HTTPS host; skip in local/non-HTTPS environments.
    const storeDomain = storeUrl.startsWith("https://") ? new URL(storeUrl).hostname : undefined;
    await addPaymentMethodsToStore(
      merchantId,
      storeIdForPaymentMethods,
      businessLineIds[0],
      storeDomain
    );
  }

  // ── PCI questionnaire signing (idempotent) ────────────────────────────────
  // The org signs its own PCI SAQ using its legal entity — responsibility stays with
  // the org. The platform only automates the API call (disclosed upfront in onboarding).
  // Runs every finalization — the underlying call checks status and no-ops if not required.
  if (account.legalEntityId) {
    await signPciForLegalEntity(account.legalEntityId);
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
