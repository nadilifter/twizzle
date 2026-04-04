import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { GET, POST } from "../[token]/route";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  hashPassword: vi.fn(() => Promise.resolve("hashed-pw")),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  RATE_LIMITS: {
    api: { max: 60, window: 60 },
    sensitive: { max: 10, window: 300 },
  },
}));

import { getAuthSession } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url: string, init?: { method?: string; body?: string }) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
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

  it("returns 401 for existing user not logged in", async () => {
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
    } as never);

    vi.mocked(getAuthSession).mockResolvedValueOnce(null);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.requiresAuth).toBe(true);
  });

  it("returns 403 when logged-in user email does not match invitation", async () => {
    vi.mocked(db.organizationInvitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      token: "valid",
      status: "PENDING",
      email: "invited@example.com",
      expiresAt: new Date(Date.now() + 86400000),
      organizationId: "org-1",
      organization: { id: "org-1", name: "Acme" },
    } as never);

    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "user-1",
      passwordHash: "existing-hash",
      status: "ACTIVE",
    } as never);

    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: { email: "wrong@example.com", id: "user-1" },
    } as never);

    const res = await POST(
      makeRequest("/api/invitations/valid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("invited@example.com");
  });

  it("accepts invitation for new user with password", async () => {
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
        }),
      }),
      makeParams("valid")
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.organizationId).toBe("org-1");

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
  });
});
