import { afterEach, describe, expect, it, vi } from "vitest";
import { executeSoap, parseSoapResponse, stripXmlWhitespace } from "../soap-client";
import { clearTokenCache } from "../oauth";
import { CrmFaultError, CrmProtocolError } from "../errors";
import type { SkateCanadaConfig } from "../config";

const TEST_CONFIG: SkateCanadaConfig = {
  tenantId: "tenant-uuid",
  appId: "app-uuid",
  appSecret: "secret",
  host: "https://example.api.crm3.dynamics.com",
};

// Pre-prime the oauth cache so executeSoap doesn't issue a token request.
function withCachedToken(): typeof fetch {
  // Set an expiry far enough in the future that the safety margin is satisfied.
  const future = Math.floor(Date.now() / 1000) + 7200;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchImpl = vi.fn() as any;
  fetchImpl.mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: "cached", expires_on: String(future) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  return fetchImpl;
}

afterEach(() => {
  clearTokenCache();
  vi.restoreAllMocks();
});

describe("stripXmlWhitespace", () => {
  it("collapses whitespace between tags", () => {
    expect(stripXmlWhitespace("<a>\n  <b>\n  </b>\n</a>")).toBe("<a><b></b></a>");
  });

  it("preserves text content inside tags", () => {
    expect(stripXmlWhitespace("<a>hello world</a>")).toBe("<a>hello world</a>");
  });
});

describe("parseSoapResponse", () => {
  it("strips namespace prefixes so Body is accessible as parsed.Envelope.Body", () => {
    const xml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body><Foo>bar</Foo></s:Body>
    </s:Envelope>`;
    const parsed = parseSoapResponse(xml);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((parsed as any).Envelope.Body.Foo).toBe("bar");
  });

  it("throws CrmProtocolError on unparseable input", () => {
    expect(() => parseSoapResponse("<<<not xml>>>")).toThrow(CrmProtocolError);
  });
});

describe("executeSoap", () => {
  it("throws CrmFaultError when the response contains an s:Fault", async () => {
    const tokenFetch = withCachedToken();
    const faultBody = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body>
        <s:Fault>
          <s:Code><s:Value>s:Receiver</s:Value></s:Code>
          <s:Reason><s:Text xml:lang="en-US">Generic CRM error</s:Text></s:Reason>
        </s:Fault>
      </s:Body>
    </s:Envelope>`;
    tokenFetch.mockResolvedValueOnce(
      new Response(faultBody, { status: 500, headers: { "content-type": "text/xml" } })
    );

    try {
      await executeSoap(TEST_CONFIG, "<s:Body><Execute/></s:Body>", { fetchImpl: tokenFetch });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CrmFaultError);
      expect((err as CrmFaultError).message).toContain("Generic CRM error");
    }
  });

  it("throws CrmProtocolError on JSON error envelope", async () => {
    const tokenFetch = withCachedToken();
    tokenFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "BadRequest", message: "Malformed envelope" } }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      )
    );

    try {
      await executeSoap(TEST_CONFIG, "<s:Body><Execute/></s:Body>", { fetchImpl: tokenFetch });
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CrmProtocolError);
      expect((err as CrmProtocolError).message).toContain("BadRequest");
    }
  });

  it("returns the raw XML body on success (no Fault)", async () => {
    const tokenFetch = withCachedToken();
    const okBody = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body><ExecuteResponse/></s:Body>
    </s:Envelope>`;
    tokenFetch.mockResolvedValueOnce(
      new Response(okBody, { status: 200, headers: { "content-type": "text/xml" } })
    );

    const text = await executeSoap(TEST_CONFIG, "<s:Body><Execute/></s:Body>", {
      fetchImpl: tokenFetch,
    });
    expect(text).toContain("<ExecuteResponse");
  });

  it("sets the SOAPAction header to IOrganizationService/Execute by default", async () => {
    const tokenFetch = withCachedToken();
    const okBody = `<s:Envelope><s:Body><ExecuteResponse/></s:Body></s:Envelope>`;
    tokenFetch.mockResolvedValueOnce(new Response(okBody, { status: 200 }));

    await executeSoap(TEST_CONFIG, "<s:Body><Execute/></s:Body>", { fetchImpl: tokenFetch });
    // The second fetch call is the SOAP request (the first is the token).
    const soapCall = tokenFetch.mock.calls[1];
    const headers = soapCall[1].headers as Record<string, string>;
    expect(headers.SOAPAction).toBe(
      "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute"
    );
    expect(headers.Authorization).toBe("Bearer cached");
  });
});
