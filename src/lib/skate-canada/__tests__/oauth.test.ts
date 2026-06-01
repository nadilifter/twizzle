import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, clearTokenCache } from "../oauth";
import { CrmAuthError, CrmProtocolError } from "../errors";
import type { SkateCanadaConfig } from "../config";

const TEST_CONFIG: SkateCanadaConfig = {
  tenantId: "tenant-uuid",
  appId: "app-uuid",
  appSecret: "secret",
  host: "https://example.api.crm3.dynamics.com",
};

function mockFetchOnce(body: unknown, status = 200): typeof fetch {
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return vi.fn().mockResolvedValueOnce(res) as any;
}

afterEach(() => {
  clearTokenCache();
  vi.restoreAllMocks();
});

describe("oauth.getAccessToken", () => {
  it("returns the access_token from the JSON body on success", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchImpl = mockFetchOnce({
      access_token: "abc.def.ghi",
      token_type: "Bearer",
      expires_in: 3600,
      expires_on: String(now + 3600),
    });
    const token = await getAccessToken(TEST_CONFIG, fetchImpl);
    expect(token).toBe("abc.def.ghi");
  });

  it("caches the token across calls until expiry", async () => {
    const now = Math.floor(Date.now() / 1000);
    const fetchImpl = mockFetchOnce({
      access_token: "first-token",
      expires_on: String(now + 3600),
    });
    await getAccessToken(TEST_CONFIG, fetchImpl);
    await getAccessToken(TEST_CONFIG, fetchImpl);
    // mockResolvedValueOnce was only set up for one call — a second one
    // would have thrown if the cache hadn't satisfied it.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("re-fetches when the cached token is past its expiry", async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const future = Math.floor(Date.now() / 1000) + 3600;
    const expiredFetch = mockFetchOnce({ access_token: "old", expires_on: String(past) });
    await getAccessToken(TEST_CONFIG, expiredFetch);
    const freshFetch = mockFetchOnce({ access_token: "new", expires_on: String(future) });
    const second = await getAccessToken(TEST_CONFIG, freshFetch);
    expect(second).toBe("new");
  });

  it("throws CrmAuthError on Azure error response (expired secret)", async () => {
    const fetchImpl = mockFetchOnce(
      {
        error: "invalid_client",
        error_description: "AADSTS7000222: The provided client secret keys for app are expired.",
      },
      401
    );
    await expect(getAccessToken(TEST_CONFIG, fetchImpl)).rejects.toBeInstanceOf(CrmAuthError);
  });

  it("includes the Azure error code on the thrown error", async () => {
    const fetchImpl = mockFetchOnce(
      { error: "unauthorized_client", error_description: "bad" },
      400
    );
    try {
      await getAccessToken(TEST_CONFIG, fetchImpl);
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CrmAuthError);
      expect((err as CrmAuthError).code).toBe("unauthorized_client");
    }
  });

  it("throws CrmProtocolError on non-JSON response", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>oops</html>", { status: 502 })) as any;
    await expect(getAccessToken(TEST_CONFIG, fetchImpl)).rejects.toBeInstanceOf(CrmProtocolError);
  });

  it("wraps network errors as CrmAuthError with cause", async () => {
    const networkError = new Error("ECONNREFUSED");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchImpl = vi.fn().mockRejectedValueOnce(networkError) as any;
    try {
      await getAccessToken(TEST_CONFIG, fetchImpl);
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CrmAuthError);
      expect((err as CrmAuthError).cause).toBe(networkError);
    }
  });
});
