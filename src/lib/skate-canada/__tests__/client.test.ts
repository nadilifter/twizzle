import { afterEach, describe, expect, it, vi } from "vitest";
import { SkateCanadaClient } from "../client";
import { clearTokenCache } from "../oauth";
import type { SkateCanadaConfig } from "../config";

const TEST_CONFIG: SkateCanadaConfig = {
  tenantId: "tenant-uuid",
  appId: "app-uuid",
  appSecret: "secret",
  host: "https://example.api.crm3.dynamics.com",
};

// Helper that returns a fetch double which (1) serves the OAuth token then
// (2) serves the SOAP body we hand it.
function mockTokenThen(soapResponseXml: string, status = 200): typeof fetch {
  const future = Math.floor(Date.now() / 1000) + 7200;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchImpl = vi.fn() as any;
  fetchImpl.mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: "tok", expires_on: String(future) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
  fetchImpl.mockResolvedValueOnce(
    new Response(soapResponseXml, { status, headers: { "content-type": "text/xml" } })
  );
  return fetchImpl;
}

afterEach(() => {
  clearTokenCache();
  vi.restoreAllMocks();
});

describe("SkateCanadaClient.getSeasons", () => {
  it("parses Entity rows into typed SkateCanadaSeason objects", async () => {
    // Two seasons in a RetrieveMultipleResponse. Real CRM responses have
    // much more noise; we keep just the path the parser walks.
    const responseXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body>
        <ExecuteResponse xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">
          <ExecuteResult>
            <Results>
              <KeyValuePairOfstringanyType>
                <key>EntityCollection</key>
                <value>
                  <Entities>
                    <Entity>
                      <Id>00000000-0000-0000-0000-000000000001</Id>
                      <Attributes>
                        <KeyValuePairOfstringanyType><key>sc_name</key><value>2025-2026</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_startdate</key><value>2025-09-01</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_enddate</key><value>2026-08-31</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>statecode</key><value>0</value></KeyValuePairOfstringanyType>
                      </Attributes>
                    </Entity>
                    <Entity>
                      <Id>00000000-0000-0000-0000-000000000002</Id>
                      <Attributes>
                        <KeyValuePairOfstringanyType><key>sc_name</key><value>2026-2027</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_startdate</key><value>2026-09-01</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_enddate</key><value>2027-08-31</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>statecode</key><value>0</value></KeyValuePairOfstringanyType>
                      </Attributes>
                    </Entity>
                  </Entities>
                </value>
              </KeyValuePairOfstringanyType>
            </Results>
          </ExecuteResult>
        </ExecuteResponse>
      </s:Body>
    </s:Envelope>`;

    const client = new SkateCanadaClient({
      config: TEST_CONFIG,
      fetchImpl: mockTokenThen(responseXml),
    });
    const seasons = await client.getSeasons("2025-09-01");
    expect(seasons).toHaveLength(2);
    expect(seasons[0]).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      name: "2025-2026",
      startDate: "2025-09-01",
      endDate: "2026-08-31",
      stateCode: 0,
    });
    expect(seasons[1].name).toBe("2026-2027");
  });

  it("returns [] when the response has no Entities", async () => {
    const responseXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body>
        <ExecuteResponse>
          <ExecuteResult>
            <Results>
              <KeyValuePairOfstringanyType>
                <key>EntityCollection</key>
                <value><Entities/></value>
              </KeyValuePairOfstringanyType>
            </Results>
          </ExecuteResult>
        </ExecuteResponse>
      </s:Body>
    </s:Envelope>`;
    const client = new SkateCanadaClient({
      config: TEST_CONFIG,
      fetchImpl: mockTokenThen(responseXml),
    });
    const seasons = await client.getSeasons("2025-09-01");
    expect(seasons).toEqual([]);
  });

  it("handles a single-entity response (fast-xml-parser collapses arrays)", async () => {
    const responseXml = `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
      <s:Body>
        <ExecuteResponse>
          <ExecuteResult>
            <Results>
              <KeyValuePairOfstringanyType>
                <key>EntityCollection</key>
                <value>
                  <Entities>
                    <Entity>
                      <Id>00000000-0000-0000-0000-000000000003</Id>
                      <Attributes>
                        <KeyValuePairOfstringanyType><key>sc_name</key><value>2027-2028</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_startdate</key><value>2027-09-01</value></KeyValuePairOfstringanyType>
                        <KeyValuePairOfstringanyType><key>sc_enddate</key><value>2028-08-31</value></KeyValuePairOfstringanyType>
                      </Attributes>
                    </Entity>
                  </Entities>
                </value>
              </KeyValuePairOfstringanyType>
            </Results>
          </ExecuteResult>
        </ExecuteResponse>
      </s:Body>
    </s:Envelope>`;
    const client = new SkateCanadaClient({
      config: TEST_CONFIG,
      fetchImpl: mockTokenThen(responseXml),
    });
    const seasons = await client.getSeasons();
    expect(seasons).toHaveLength(1);
    expect(seasons[0].name).toBe("2027-2028");
  });
});
