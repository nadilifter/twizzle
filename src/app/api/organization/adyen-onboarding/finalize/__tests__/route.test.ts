import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn() }));

vi.mock("@/lib/adyen-onboarding-finalize", () => ({
  finalizeOrgOnboarding: vi.fn(),
}));

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { finalizeOrgOnboarding } from "@/lib/adyen-onboarding-finalize";
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

function authedSession() {
  vi.mocked(getAuthSession).mockResolvedValueOnce({
    user: { organizationId: "org-1", permissions: ["financials.create"] },
  } as never);
}

describe("POST /api/organization/adyen-onboarding/finalize", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null as never);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(finalizeOrgOnboarding).not.toHaveBeenCalled();
  });

  it("returns 403 without financials.create permission", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { organizationId: "org-1", permissions: [] },
    } as never);

    const res = await POST();

    expect(res.status).toBe(403);
  });

  it("returns 400 when no AdyenPlatformAccount exists", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/onboarding not started/i);
    expect(finalizeOrgOnboarding).not.toHaveBeenCalled();
  });

  it("returns 400 when onboardingStatus is not VERIFIED", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "AWAITING_DATA",
    } as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/AWAITING_DATA/);
    expect(finalizeOrgOnboarding).not.toHaveBeenCalled();
  });

  it("happy path: returns finalizer result with 200", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "VERIFIED",
    } as never);
    const finalizerResult = {
      storeId: "store-1",
      sweepId: "sweep-1",
      splitConfigurationId: "split-1",
    };
    vi.mocked(finalizeOrgOnboarding).mockResolvedValueOnce(finalizerResult as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(finalizerResult);
    expect(finalizeOrgOnboarding).toHaveBeenCalledWith("org-1");
  });

  it("maps NOT_FOUND error code to 404", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "VERIFIED",
    } as never);
    vi.mocked(finalizeOrgOnboarding).mockRejectedValueOnce(
      Object.assign(new Error("Account not found"), { code: "NOT_FOUND" })
    );

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Account not found");
  });

  it("maps PRECONDITION error code to 400 with message", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "VERIFIED",
    } as never);
    vi.mocked(finalizeOrgOnboarding).mockRejectedValueOnce(
      Object.assign(new Error("Organization has no plan"), {
        code: "PRECONDITION",
      })
    );

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Organization has no plan");
  });

  it("maps CONFIG_ERROR to 500", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "VERIFIED",
    } as never);
    vi.mocked(finalizeOrgOnboarding).mockRejectedValueOnce(
      Object.assign(new Error("Missing ADYEN_PLATFORM_MERCHANT_ACCOUNT"), {
        code: "CONFIG_ERROR",
      })
    );

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Missing ADYEN_PLATFORM_MERCHANT_ACCOUNT");
  });

  it("returns generic 500 for unexpected errors without a code", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      onboardingStatus: "VERIFIED",
    } as never);
    vi.mocked(finalizeOrgOnboarding).mockRejectedValueOnce(new Error("boom"));

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to finalize onboarding");
  });
});
