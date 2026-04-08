import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.hoisted(() => {
  process.env.CRON_SECRET = "test-secret";
});

vi.mock("@/lib/subscription-billing", () => ({
  processDunningEmails: vi.fn(),
  deactivateExpiredOrgs: vi.fn(),
  recoverAndRetryStaleInvoices: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  RATE_LIMITS: {
    api: { max: 60, window: 60 },
    sensitive: { max: 10, window: 300 },
  },
}));

import { GET, POST } from "../subscription-dunning/route";
import {
  processDunningEmails,
  deactivateExpiredOrgs,
  recoverAndRetryStaleInvoices,
} from "@/lib/subscription-billing";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: headers ?? {},
  } as never);
}

describe("GET /api/cron/subscription-dunning", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await GET(makeRequest("/api/cron/subscription-dunning"));
    expect(res.status).toBe(401);
  });

  it("supports dry run mode", async () => {
    const res = await GET(
      makeRequest("/api/cron/subscription-dunning?dryRun=true", {
        authorization: "Bearer test-secret",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.dryRun).toBe(true);
    expect(recoverAndRetryStaleInvoices).not.toHaveBeenCalled();
  });

  it("runs all three phases in order: recover, dunning, deactivate", async () => {
    vi.mocked(recoverAndRetryStaleInvoices).mockResolvedValueOnce({
      recovered: 1,
      retried: 2,
      retriedPaid: 1,
      errors: [],
    });
    vi.mocked(processDunningEmails).mockResolvedValueOnce({
      sent: 3,
      errors: [],
    });
    vi.mocked(deactivateExpiredOrgs).mockResolvedValueOnce({
      deactivated: 1,
      errors: [],
    });

    const res = await GET(
      makeRequest("/api/cron/subscription-dunning", {
        authorization: "Bearer test-secret",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.summary).toEqual({
      stuckInvoicesRecovered: 1,
      staleInvoicesRetried: 2,
      staleInvoicesPaid: 1,
      warningEmailsSent: 3,
      organizationsDeactivated: 1,
    });
  });

  it("aggregates errors from all phases", async () => {
    vi.mocked(recoverAndRetryStaleInvoices).mockResolvedValueOnce({
      recovered: 0,
      retried: 0,
      retriedPaid: 0,
      errors: ["recovery error"],
    });
    vi.mocked(processDunningEmails).mockResolvedValueOnce({
      sent: 0,
      errors: ["dunning error"],
    });
    vi.mocked(deactivateExpiredOrgs).mockResolvedValueOnce({
      deactivated: 0,
      errors: ["deactivation error"],
    });

    const res = await GET(
      makeRequest("/api/cron/subscription-dunning", {
        authorization: "Bearer test-secret",
      })
    );
    const json = await res.json();

    expect(json.errors).toHaveLength(3);
    expect(json.errors).toContain("recovery error");
    expect(json.errors).toContain("dunning error");
    expect(json.errors).toContain("deactivation error");
  });

  it("POST delegates to GET", async () => {
    vi.mocked(recoverAndRetryStaleInvoices).mockResolvedValueOnce({
      recovered: 0,
      retried: 0,
      retriedPaid: 0,
      errors: [],
    });
    vi.mocked(processDunningEmails).mockResolvedValueOnce({
      sent: 0,
      errors: [],
    });
    vi.mocked(deactivateExpiredOrgs).mockResolvedValueOnce({
      deactivated: 0,
      errors: [],
    });

    const res = await POST(
      makeRequest("/api/cron/subscription-dunning", {
        authorization: "Bearer test-secret",
      })
    );

    expect(res.status).toBe(200);
  });
});
