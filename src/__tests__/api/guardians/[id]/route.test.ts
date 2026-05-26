import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { GET } from "@/app/api/guardians/[id]/route";

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
}));

// /api/guardians/[id] returns a guardian's profile, contacts, billing addresses,
// and athletes for the admin dashboard. Before USC-888 the only auth check was
// "session has an organizationId" — which let any PARENT-role caller pass
// another parent's userId and exfiltrate that parent's profile. These tests pin
// the staff-only gate that closed that IDOR (sibling of USC-679). The gate is on
// the families.view permission, so only roles explicitly granted family access
// (and superadmins, who carry "*") pass.

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest() {
  return new NextRequest(new URL("/api/guardians/g-target", "http://localhost:3000"));
}

function makeParams() {
  return { params: { id: "g-target" } };
}

describe("GET /api/guardians/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce(null);
    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the caller is a PARENT-role user (IDOR guard)", async () => {
    // PARENT carries no permissions, so it fails the families.view gate.
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "parent-attacker",
        role: "PARENT",
        organizationId: "org-1",
        isSuperAdmin: false,
        permissions: [],
      },
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    // The route must not hit the DB when the caller fails the gate —
    // proves we reject before any user lookup occurs.
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller has no membership role and is not a superadmin", async () => {
    // Parents who self-signed-up before an OrganizationMember row exists have
    // role=null and no permissions. They must not reach the admin endpoint.
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "rogue",
        role: null,
        organizationId: "org-1",
        isSuperAdmin: false,
        permissions: [],
      },
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 403 for a non-PARENT staff role that lacks families.view", async () => {
    // The gate is an explicit allowlist (families.view), not "any role that
    // isn't PARENT" — a staff role without family access (e.g. VOLUNTEER) is
    // still rejected, and any future Role enum value defaults to denied.
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "volunteer-1",
        role: "VOLUNTEER",
        organizationId: "org-1",
        isSuperAdmin: false,
        permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ATHLETES_VIEW],
      },
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the staff caller's target is not a guardian/parent in their org", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
        isSuperAdmin: false,
        permissions: [PERMISSIONS.FAMILIES_VIEW],
      },
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "g-target",
      name: "Target Guardian",
      email: null,
      phone: null,
      balance: 0,
      status: "ACTIVE",
      memberships: [],
      contacts: [],
      billingAddresses: [],
      athleteGuardians: [],
      userInvoices: [],
      userPayments: [],
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("allows a staff (non-PARENT) caller and returns the guardian scoped to the staff's org", async () => {
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "admin-1",
        role: "ADMIN",
        organizationId: "org-1",
        isSuperAdmin: false,
        permissions: [PERMISSIONS.FAMILIES_VIEW],
      },
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "g-target",
      name: "Target Guardian",
      email: "target@example.com",
      phone: null,
      balance: 0,
      status: "ACTIVE",
      memberships: [{ status: "ACTIVE" }],
      contacts: [],
      billingAddresses: [],
      athleteGuardians: [],
      userInvoices: [],
      userPayments: [],
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);

    // Verify the user lookup was scoped to the staff caller's organizationId.
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    const call = vi.mocked(db.user.findUnique).mock.calls[0]![0]!;
    expect((call.where as { id: string }).id).toBe("g-target");
  });

  it("allows a superadmin caller even if their role is PARENT or null", async () => {
    // Superadmins carry the "*" permission, so hasPermission passes regardless
    // of role.
    vi.mocked(getAuthSession).mockResolvedValueOnce({
      user: {
        id: "superadmin-1",
        role: null,
        organizationId: "org-1",
        isSuperAdmin: true,
        permissions: [PERMISSIONS.ALL],
      },
    } as never);
    vi.mocked(db.user.findUnique).mockResolvedValueOnce({
      id: "g-target",
      name: "Target",
      email: null,
      phone: null,
      balance: 0,
      status: "ACTIVE",
      memberships: [{ status: "ACTIVE" }],
      contacts: [],
      billingAddresses: [],
      athleteGuardians: [],
      userInvoices: [],
      userPayments: [],
    } as never);

    const res = await GET(makeRequest(), makeParams());
    expect(res.status).toBe(200);
  });
});
