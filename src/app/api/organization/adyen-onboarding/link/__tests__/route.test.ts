import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getAuthSession: vi.fn() }));

vi.mock("@/lib/adyen-platform", () => ({
  generateOnboardingLink: vi.fn(),
  createBusinessLine: vi.fn(),
}));

vi.mock("@/lib/webhooks", () => ({
  getWebhookBaseUrl: vi.fn(() => "https://app.example.com"),
}));

vi.mock("@/lib/env-domains", () => ({
  getSubdomainUrl: vi.fn(() => "https://acme.example.com"),
}));

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { generateOnboardingLink, createBusinessLine } from "@/lib/adyen-platform";
import { POST } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
});

function authedSession() {
  vi.mocked(getAuthSession).mockResolvedValueOnce({
    user: { organizationId: "org-1", permissions: ["financials.create"] },
  } as never);
}

describe("POST /api/organization/adyen-onboarding/link", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null as never);

    const res = await POST();

    expect(res.status).toBe(401);
    expect(generateOnboardingLink).not.toHaveBeenCalled();
  });

  it("returns 403 without financials.create permission", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { organizationId: "org-1", permissions: [] },
    } as never);

    const res = await POST();

    expect(res.status).toBe(403);
  });

  it("returns 400 when no AdyenPlatformAccount exists for the org", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce(null as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/onboarding not started/i);
    expect(generateOnboardingLink).not.toHaveBeenCalled();
  });

  it("returns 400 when legalEntityId is missing on the account", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      legalEntityId: null,
    } as never);

    const res = await POST();

    expect(res.status).toBe(400);
    expect(generateOnboardingLink).not.toHaveBeenCalled();
  });

  it("happy path: generates a link and persists the new business line ID", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      legalEntityId: "LE1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      slug: "acme",
      websiteConfig: { subdomain: "acme" },
    } as never);
    vi.mocked(createBusinessLine).mockResolvedValueOnce({ id: "BL-NEW" } as never);
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce({} as never);
    vi.mocked(generateOnboardingLink).mockResolvedValueOnce({
      url: "https://hosted.adyen.com/onboarding/abc",
    } as never);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ url: "https://hosted.adyen.com/onboarding/abc" });
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: { businessLineId: "BL-NEW" },
    });
    expect(generateOnboardingLink).toHaveBeenCalledWith(
      "LE1",
      "https://app.example.com/dashboard/financials/onboarding"
    );
  });

  it("recovers existing business line ID from a 422 duplicate and continues", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      legalEntityId: "LE1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      slug: "acme",
      websiteConfig: { subdomain: "acme" },
    } as never);
    vi.mocked(createBusinessLine).mockRejectedValueOnce(
      Object.assign(new Error("duplicate"), {
        statusCode: 422,
        responseBody: JSON.stringify({
          invalidFields: [
            {
              name: "ACQUIRING_BUSINESS_LINE",
              message: "duplicate business line",
              value: "BL-EXISTING",
            },
          ],
        }),
      })
    );
    vi.mocked(db.adyenPlatformAccount.update).mockResolvedValueOnce({} as never);
    vi.mocked(generateOnboardingLink).mockResolvedValueOnce({
      url: "https://hosted.adyen.com/onboarding/xyz",
    } as never);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).toHaveBeenCalledWith({
      where: { id: "ap-1" },
      data: { businessLineId: "BL-EXISTING" },
    });
    expect(generateOnboardingLink).toHaveBeenCalled();
  });

  // Codifies the product decision in route.ts: a non-422 business-line failure
  // is intentionally non-fatal — we still hand the merchant a hosted onboarding
  // URL and let Adyen's flow surface any remaining gaps. Without this, a
  // transient Adyen 5xx during BL creation would block onboarding entirely.
  it("proceeds to link generation even if business line creation fails non-fatally", async () => {
    authedSession();
    vi.mocked(db.adyenPlatformAccount.findUnique).mockResolvedValueOnce({
      id: "ap-1",
      legalEntityId: "LE1",
    } as never);
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce({
      slug: "acme",
      websiteConfig: null,
    } as never);
    vi.mocked(createBusinessLine).mockRejectedValueOnce(
      Object.assign(new Error("server error"), { statusCode: 500 })
    );
    vi.mocked(generateOnboardingLink).mockResolvedValueOnce({
      url: "https://hosted.adyen.com/onboarding/fallback",
    } as never);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(db.adyenPlatformAccount.update).not.toHaveBeenCalled();
    expect(generateOnboardingLink).toHaveBeenCalled();
  });
});
