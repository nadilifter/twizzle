import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { DELETE, POST } from "../route";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/lib/rate-limit")>("@/lib/rate-limit");
  return {
    ...actual,
    checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  };
});

import { getAuthSession } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(headers: Record<string, string> = {}, method: string = "POST") {
  const h = new Headers(headers);
  return new NextRequest(new URL("/api/account/sms-consent", "http://localhost:3000"), {
    method,
    headers: h,
  });
}

describe("POST /api/account/sms-consent", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("records consent with ACCOUNT_SETTINGS source and captures IP", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { id: "user-1" },
    } as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await POST(makeRequest({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: expect.objectContaining({
        smsConsentAt: expect.any(Date),
        smsConsentSource: "ACCOUNT_SETTINGS",
        smsConsentIp: "203.0.113.5",
        smsConsentVersion: expect.any(String),
        smsOptOut: false,
        smsOptOutAt: null,
      }),
    });
  });

  it("stores null IP when proxy headers are missing", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { id: "user-2" },
    } as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    await POST(makeRequest());

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ smsConsentIp: null }),
      })
    );
  });

  it("clears any prior opt-out when granting consent", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { id: "user-3" },
    } as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    await POST(makeRequest());

    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsOptOut: false,
          smsOptOutAt: null,
        }),
      })
    );
  });
});

describe("DELETE /api/account/sms-consent", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);

    const res = await DELETE(makeRequest({}, "DELETE"));

    expect(res.status).toBe(401);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("clears consent fields, sets smsOptOut=true, and records revoke source", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { id: "user-4" },
    } as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await DELETE(makeRequest({}, "DELETE"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "user-4" },
      data: {
        smsConsentAt: null,
        smsConsentSource: null,
        smsConsentIp: null,
        smsConsentVersion: null,
        smsConsentRevokeSource: "ACCOUNT_SETTINGS",
        smsOptOut: true,
        smsOptOutAt: expect.any(Date),
      },
    });
  });
});
