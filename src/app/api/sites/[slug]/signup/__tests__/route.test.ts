import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { POST } from "../route";

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed-pw")),
  isUplifterEmail: vi.fn(() => false),
}));

vi.mock("@/lib/mfa", () => ({
  verifyVerifiedToken: vi.fn(() => ({ email: "parent@example.com" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  getClientIp: vi.fn(() => "203.0.113.5"),
  RATE_LIMITS: {
    api: { max: 60, window: 60 },
    sensitive: { max: 10, window: 300 },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(body: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  return new NextRequest(new URL("/api/sites/acme/signup", "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function mockHappyPath() {
  vi.mocked(db.websiteConfig.findUnique).mockResolvedValueOnce({
    organizationId: "org-1",
    isPublished: true,
    organization: { id: "org-1", name: "Acme" },
  } as never);
  vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
  vi.mocked(db.$transaction).mockImplementation(async (fn) => {
    return (fn as CallableFunction)(db);
  });
  vi.mocked(db.user.create).mockResolvedValueOnce({
    id: "user-1",
    email: "parent@example.com",
    name: "Parent",
  } as never);
  vi.mocked(db.organizationMember.create).mockResolvedValueOnce({} as never);
}

const VALID_BODY = {
  name: "Parent",
  email: "parent@example.com",
  password: "StrongPass1!",
  confirmPassword: "StrongPass1!",
  verificationToken: "verified-token",
  acceptedTerms: true as const,
};

describe("POST /api/sites/[slug]/signup", () => {
  it("persists all 4 consent fields when smsConsent=true", async () => {
    mockHappyPath();

    const res = await POST(makeRequest({ ...VALID_BODY, smsConsent: true }), makeParams("acme"));

    expect(res.status).toBe(200);
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsConsentAt: expect.any(Date),
          smsConsentSource: "SIGNUP_SITE",
          smsConsentIp: "203.0.113.5",
          smsConsentVersion: expect.any(String),
          smsOptOut: false,
          smsOptOutAt: null,
        }),
      })
    );
  });

  it("writes no consent fields when smsConsent=false", async () => {
    mockHappyPath();

    const res = await POST(makeRequest({ ...VALID_BODY, smsConsent: false }), makeParams("acme"));

    expect(res.status).toBe(200);
    const createCall = vi.mocked(db.user.create).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data).not.toHaveProperty("smsConsentAt");
    expect(createCall.data).not.toHaveProperty("smsConsentSource");
    expect(createCall.data).not.toHaveProperty("smsConsentIp");
    expect(createCall.data).not.toHaveProperty("smsConsentVersion");
  });

  it("writes no consent fields when smsConsent is omitted", async () => {
    mockHappyPath();

    const res = await POST(makeRequest(VALID_BODY), makeParams("acme"));

    expect(res.status).toBe(200);
    const createCall = vi.mocked(db.user.create).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data).not.toHaveProperty("smsConsentAt");
    expect(createCall.data).not.toHaveProperty("smsConsentSource");
  });
});
