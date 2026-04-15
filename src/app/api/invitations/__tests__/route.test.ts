import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GET, POST } from "../[token]/route";

vi.mock("@/lib/auth", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed-pw")),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  getClientIp: vi.fn(() => "203.0.113.7"),
  RATE_LIMITS: {
    api: { max: 60, window: 60 },
    sensitive: { max: 10, window: 300 },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url: string, init?: { method?: string; body?: string }) {
  const headers = new Headers();
  if (init?.body) headers.set("content-type", "application/json");
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: init?.method,
    body: init?.body,
    headers,
  });
}

function makeParams(token: string) {
  return { params: Promise.resolve({ token }) };
}

describe("GET /api/invitations/[token]", () => {
  it("returns 404 for invalid token", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce(null);

    const res = await GET(makeRequest("/api/invitations/bad-token"), makeParams("bad-token"));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.valid).toBe(false);
    expect(json.errorCode).toBe("INVALID_TOKEN");
  });

  it("returns 400 for already accepted invitation", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "test-token",
      status: "ACCEPTED",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: "org-1", name: "Acme" },
      invitedBy: { name: "Admin" },
    } as never);

    const res = await GET(makeRequest("/api/invitations/test-token"), makeParams("test-token"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errorCode).toBe("ALREADY_ACCEPTED");
  });

  it("returns 400 and marks as EXPIRED for expired invitation", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "expired-token",
      status: "PENDING",
      email: "user@example.com",
      expiresAt: new Date(Date.now() - 86400000),
      organization: { id: "org-1", name: "Acme" },
      invitedBy: { name: "Admin" },
    } as never);
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);

    const res = await GET(
      makeRequest("/api/invitations/expired-token"),
      makeParams("expired-token")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.errorCode).toBe("EXPIRED");
    expect(db.organizationInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "EXPIRED" },
      })
    );
  });

  it("returns valid response for pending invitation with existing user", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid-token",
      status: "PENDING",
      email: "user@example.com",
      role: "MEMBER",
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: "org-1", name: "Acme" },
      invitedBy: { name: "Admin" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
      passwordHash: "existing-hash",
      status: "ACTIVE",
    } as never);

    const res = await GET(makeRequest("/api/invitations/valid-token"), makeParams("valid-token"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.valid).toBe(true);
    expect(json.user.exists).toBe(true);
    expect(json.user.needsPassword).toBe(false);
  });

  it("flags needsPassword for users with INVITED status", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid-token",
      status: "PENDING",
      email: "new@example.com",
      role: "MEMBER",
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: "org-1", name: "Acme" },
      invitedBy: { name: "Admin" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-2",
      name: null,
      email: "new@example.com",
      passwordHash: null,
      status: "INVITED",
    } as never);

    const res = await GET(makeRequest("/api/invitations/valid-token"), makeParams("valid-token"));
    const json = await res.json();

    expect(json.valid).toBe(true);
    expect(json.user.needsPassword).toBe(true);
  });
});

describe("POST /api/invitations/[token]", () => {
  it("returns 404 for invalid token", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest("/api/invitations/bad-token", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("bad-token")
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
  });

  it("returns 400 for expired invitation", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "expired",
      status: "PENDING",
      email: "user@example.com",
      expiresAt: new Date(Date.now() - 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    const res = await POST(
      makeRequest("/api/invitations/expired", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("expired")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("expired");
  });

  it("returns 400 when terms not accepted", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
      termsAcceptedAt: null,
    } as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("terms");
  });

  it("accepts invitation for existing user with accepted terms", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(json).toMatchObject({ success: true, organizationId: "org-1" });
    expect(res.status).toBe(200);
    expect(db.organizationInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
  });

  it("accepts invitation for new user with password and terms", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "new@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: null,
      status: "INVITED",
      termsAcceptedAt: null,
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({
          password: "StrongPass1!",
          confirmPassword: "StrongPass1!",
          acceptedTerms: true,
        }),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(json).toMatchObject({ success: true, organizationId: "org-1" });
    expect(res.status).toBe(200);
    expect(db.organizationInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACCEPTED" }),
      })
    );
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: "hashed-pw",
          status: "ACTIVE",
        }),
      })
    );
    // Without smsConsent in the body, no consent fields should be written.
    expect(db.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ smsConsentAt: expect.anything() }),
      })
    );
  });

  it("persists SMS consent for new user when smsConsent=true", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "new@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: null,
      status: "INVITED",
      termsAcceptedAt: null,
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({
          password: "StrongPass1!",
          confirmPassword: "StrongPass1!",
          acceptedTerms: true,
          smsConsent: true,
        }),
      }),
      makeParams("valid")
    );

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsConsentAt: expect.any(Date),
          smsConsentSource: "INVITATION",
          smsConsentVersion: expect.any(String),
          smsOptOut: false,
        }),
      })
    );
  });

  it("persists SMS consent for existing user when smsConsent=true", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "existing@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({ smsConsent: true }),
      }),
      makeParams("valid")
    );

    expect(res.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          smsConsentAt: expect.any(Date),
          smsConsentSource: "INVITATION",
          smsOptOut: false,
        }),
      })
    );
  });

  it("does not write to user when existing user has terms and no smsConsent", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "existing@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("valid")
    );

    expect(res.status).toBe(200);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("does not overwrite prior consent when existing user re-accepts with smsConsent=true", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "existing@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
      termsAcceptedAt: new Date(),
      // User already consented earlier (e.g. via ACCOUNT_SETTINGS).
      smsConsentAt: new Date("2026-01-01"),
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({ smsConsent: true }),
      }),
      makeParams("valid")
    );

    expect(res.status).toBe(200);
    // The route should neither call user.update with consent fields nor
    // silently downgrade smsConsentSource to "INVITATION".
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("writes no consent fields when smsConsent=false is explicit (new user)", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "new@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: null,
      status: "INVITED",
      termsAcceptedAt: null,
    } as never);

    vi.mocked(db.$transaction).mockImplementation(async (fn) => {
      await (fn as CallableFunction)(db);
    });
    vi.mocked(db.organizationInvitation.update).mockResolvedValueOnce({} as never);
    vi.mocked(db.organizationMember.updateMany).mockResolvedValueOnce({} as never);
    vi.mocked(db.user.update).mockResolvedValueOnce({} as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({
          password: "StrongPass1!",
          confirmPassword: "StrongPass1!",
          acceptedTerms: true,
          smsConsent: false,
        }),
      }),
      makeParams("valid")
    );

    expect(res.status).toBe(200);
    expect(db.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ smsConsentAt: expect.anything() }),
      })
    );
  });
});
