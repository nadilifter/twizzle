import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

vi.hoisted(() => {
  process.env.CRON_SECRET = "test-secret";
});

vi.mock("@/lib/subscription-billing", () => ({
  generateMonthlyInvoices: vi.fn(),
  processInvoicePayment: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkApiRateLimit: vi.fn(() => Promise.resolve(undefined)),
  RATE_LIMITS: {
    api: { max: 60, window: 60 },
    sensitive: { max: 10, window: 300 },
  },
}));

import { GET, POST } from "../subscription-billing/route";
import { generateMonthlyInvoices, processInvoicePayment } from "@/lib/subscription-billing";

beforeEach(() => {
  vi.clearAllMocks();
});

function makeRequest(url: string, headers?: Record<string, string>) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    headers: headers ?? {},
  } as never);
}

describe("GET /api/cron/subscription-billing", () => {
  it("rejects requests without authorization", async () => {
    const res = await GET(makeRequest("/api/cron/subscription-billing"));
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong secret", async () => {
    const res = await GET(
      makeRequest("/api/cron/subscription-billing", {
        authorization: "Bearer wrong-secret",
      })
    );
    expect(res.status).toBe(401);
  });

  it("supports dry run mode", async () => {
    const res = await GET(
      makeRequest("/api/cron/subscription-billing?dryRun=true", {
        authorization: "Bearer test-secret",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.dryRun).toBe(true);
    expect(generateMonthlyInvoices).not.toHaveBeenCalled();
  });

  it("generates invoices and processes payments", async () => {
    vi.mocked(generateMonthlyInvoices).mockResolvedValueOnce({
      generated: 5,
      skipped: 2,
      errors: [],
    });

    vi.mocked(db.subscriptionInvoice.findMany).mockResolvedValueOnce([
      { id: "inv-1" },
      { id: "inv-2" },
    ] as never);

    vi.mocked(processInvoicePayment).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await GET(
      makeRequest("/api/cron/subscription-billing", {
        authorization: "Bearer test-secret",
      })
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.summary.invoicesGenerated).toBe(5);
    expect(json.summary.invoicesSkipped).toBe(2);
    expect(json.summary.paymentsPaid).toBe(1);
    expect(json.summary.paymentsFailed).toBe(1);
  });

  it("POST delegates to GET", async () => {
    vi.mocked(generateMonthlyInvoices).mockResolvedValueOnce({
      generated: 0,
      skipped: 0,
      errors: [],
    });
    vi.mocked(db.subscriptionInvoice.findMany).mockResolvedValueOnce([]);

    const res = await POST(
      makeRequest("/api/cron/subscription-billing", {
        authorization: "Bearer test-secret",
      })
    );

    expect(res.status).toBe(200);
  });
});
