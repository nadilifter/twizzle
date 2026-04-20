import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createStore,
  getStoreByReference,
  createSweep,
  getLegalEntity,
} from "@/lib/adyen-platform";

/**
 * POST /api/organization/adyen-onboarding/finalize
 * Creates the Store and configures Sweep after verification passes.
 */
export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permissions = session.user.permissions || [];
    if (!permissions.includes("*") && !permissions.includes("financials.create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgId = session.user.organizationId;
    const account = await db.adyenPlatformAccount.findUnique({
      where: { organizationId: orgId, accountStatus: "ACTIVE" },
    });

    if (!account) {
      return NextResponse.json({ error: "Onboarding not started" }, { status: 400 });
    }

    if (account.onboardingStatus !== "VERIFIED") {
      return NextResponse.json(
        { error: `Cannot finalize: current status is ${account.onboardingStatus}` },
        { status: 400 }
      );
    }

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
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const updates: any = {};

    // Create Store (idempotent -- skip if already set)
    if (!account.storeId) {
      if (!org.phone) {
        return NextResponse.json(
          {
            error:
              "Organization phone number is missing. Please update your organization details before finalizing setup.",
          },
          { status: 400 }
        );
      }

      // Format phone number to E.164 for Adyen if it's not already
      let formattedPhone = org.phone;
      let cleaned = org.phone.replace(/[^\d+]/g, "");
      if (!cleaned.startsWith("+")) {
        cleaned = cleaned.length === 11 && cleaned.startsWith("1") ? `+${cleaned}` : `+1${cleaned}`;
      }
      if (cleaned.length >= 10) {
        formattedPhone = cleaned;
      } else {
        return NextResponse.json(
          { error: "Organization phone number is invalid. Please provide a valid phone number." },
          { status: 400 }
        );
      }

      // Adyen shopper statement must be alphanumeric/spaces and max 22 chars
      const sanitizedName = org.name
        .replace(/[^a-zA-Z0-9\s&,.\-_@]/g, "")
        .substring(0, 22)
        .trim();

      const merchantId = process.env.ADYEN_PLATFORM_MERCHANT_ACCOUNT || "";
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
        });
      } catch (error: any) {
        // Store already exists in Adyen (e.g. after a local DB seed) — recover
        // by fetching the existing store via its deterministic reference.
        if (error.statusCode === 400 && error.responseBody?.includes("Store already exists")) {
          const existing = await getStoreByReference(merchantId, storeReference);
          if (!existing) throw error;
          store = existing;
        } else {
          throw error;
        }
      }

      updates.storeId = store.id;
      updates.storeReference = store.reference;
    }

    // Create Sweep -- need the transfer instrument from the legal entity
    let transferInstrumentId: string | null = null;
    if (!account.sweepId && account.balanceAccountId && account.legalEntityId) {
      transferInstrumentId = await findTransferInstrumentId(account.legalEntityId);

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
          // Sweep already exists in Adyen (e.g. after a local DB reset) — recover
          // by extracting the existing sweep ID from the 422 error detail.
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

    return NextResponse.json({
      storeId: updates.storeId || account.storeId,
      storeReference: updates.storeReference || account.storeReference,
      sweepId: updates.sweepId || account.sweepId || null,
    });
  } catch (error: any) {
    console.error("Finalization failed:", error);
    return NextResponse.json({ error: "Failed to finalize onboarding" }, { status: 500 });
  }
}

/**
 * Discover the transfer instrument ID from the legal entity.
 * Bank accounts added during hosted onboarding are stored as transfer instruments
 * on the legal entity, not as payment instruments on the balance account.
 */
async function findTransferInstrumentId(legalEntityId: string): Promise<string | null> {
  try {
    const entity = await getLegalEntity(legalEntityId);
    const instruments: Array<{ id: string }> = entity.transferInstruments || [];
    return instruments[0]?.id ?? null;
  } catch (error) {
    console.error("Failed to find transfer instrument:", error);
    return null;
  }
}
