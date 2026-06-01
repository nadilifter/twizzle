// Dynamics CRM 2011 Organization Service SOAP client.
//
// Ports the PHP CrmSoap::ExecuteSOAPRequest flow:
//   POST {crm_host}/XRMServices/2011/Organization.svc/web
//        Authorization: Bearer {oauth_token}
//        SOAPAction: http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute
//        Content-Type: text/xml; charset=UTF-8
//        body: <s:Envelope ...>...</s:Envelope>
//
// Response handling:
//   - HTTP-level / token errors → CrmAuthError (rethrown by caller from oauth)
//   - SOAP Fault (response contains <s:Fault>) → CrmFaultError with the Reason text
//   - Otherwise, returns the raw response XML for the caller's operation-
//     specific parser to consume. (Each high-level operation knows exactly
//     which entity shape it expects, so we keep the parser local to it.)
//
// Envelope construction uses template strings — the same pattern as the
// PHP. The Dynamics SOAP envelope shapes are stable + simple enough that
// hand-rolling them is clearer than a generic XML builder.

import { XMLParser } from "fast-xml-parser";
import { getAccessToken } from "./oauth";
import { type SkateCanadaConfig } from "./config";
import { CrmFaultError, CrmProtocolError } from "./errors";

const SOAP_HEADERS = `<s:Header>
  <UserType xmlns="http://schemas.microsoft.com/xrm/2011/Contracts">CrmUser</UserType>
  <SdkClientVersion xmlns="http://schemas.microsoft.com/xrm/2011/Contracts">9.1</SdkClientVersion>
</s:Header>`;

const DEFAULT_ACTION =
  "http://schemas.microsoft.com/xrm/2011/Contracts/Services/IOrganizationService/Execute";

const PARSER = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseAttributeValue: false,
  parseTagValue: false,
});

interface ExecuteOptions {
  /** SOAPAction header. Defaults to IOrganizationService/Execute. */
  action?: string;
  /** Override fetch (for tests). */
  fetchImpl?: typeof fetch;
  /** Per-request timeout in milliseconds. Default 90 seconds (matches PHP). */
  timeoutMs?: number;
}

/**
 * Build the full SOAP envelope from a request <s:Body>...</s:Body> fragment.
 * Strips leading whitespace on every line so the wire payload is compact
 * (Dynamics 2011 is picky about empty text nodes inside some elements).
 */
function buildEnvelope(bodyFragment: string): string {
  const stripped = stripXmlWhitespace(bodyFragment);
  return (
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">` +
    SOAP_HEADERS +
    stripped +
    `</s:Envelope>`
  );
}

/**
 * Collapse whitespace between XML tags. The PHP did this with a regex
 * because Dynamics 2011's `<s:Body>` rejects whitespace-only text nodes
 * between certain wrapper elements. Same regex here.
 */
export function stripXmlWhitespace(xml: string): string {
  return xml.replace(/>\s+</g, "><").trim();
}

/**
 * Execute a SOAP request against the CRM Organization service.
 * Returns the raw response XML string — caller is responsible for parsing
 * the operation-specific shape (e.g. extracting Entities, KeyValuePairs).
 *
 * Throws:
 *   - CrmAuthError    — token acquisition or 401 from the SOAP endpoint
 *   - CrmFaultError   — SOAP envelope contained a <Fault>
 *   - CrmProtocolError — non-XML response, unexpected status, parse failure
 */
export async function executeSoap(
  config: SkateCanadaConfig,
  bodyFragment: string,
  options: ExecuteOptions = {}
): Promise<string> {
  const { action = DEFAULT_ACTION, fetchImpl = fetch, timeoutMs = 90_000 } = options;

  const envelope = buildEnvelope(bodyFragment);
  const url = `${config.host}/XRMServices/2011/Organization.svc/web`;
  const token = await getAccessToken(config, fetchImpl);

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/xml; charset=UTF-8",
        SOAPAction: action,
        Connection: "Keep-Alive",
      },
      body: envelope,
      signal: ac.signal,
    });
  } catch (cause) {
    throw new CrmProtocolError("Failed to reach CRM SOAP endpoint", { cause });
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  // Dynamics sometimes returns JSON on error (e.g. token rejected, malformed
  // request). Detect that and surface a useful error.
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as { error?: { code?: string; message?: string } };
      const code = parsed.error?.code ?? `HTTP ${response.status}`;
      const message = parsed.error?.message ?? text;
      throw new CrmProtocolError(`${code}: ${message}`);
    } catch (err) {
      if (err instanceof CrmProtocolError) throw err;
      throw new CrmProtocolError(
        `Unexpected JSON response (HTTP ${response.status}): ${text.slice(0, 200)}`
      );
    }
  }

  if (!text.startsWith("<")) {
    throw new CrmProtocolError(
      `Invalid SOAP response (HTTP ${response.status}): ${text.slice(0, 200)}`
    );
  }

  // Detect <s:Fault> before treating the response as a successful payload.
  // The fault has a <Reason><Text>...</Text></Reason> structure.
  const faultMatch = text.match(/<(?:\w+:)?Fault\b[\s\S]*?<\/(?:\w+:)?Fault>/);
  if (faultMatch) {
    const reasonMatch = faultMatch[0].match(/<Text[^>]*>([\s\S]*?)<\/Text>/);
    const codeMatch = faultMatch[0].match(/<Value[^>]*>([\s\S]*?)<\/Value>/);
    throw new CrmFaultError(
      reasonMatch ? reasonMatch[1].trim() : "CRM returned a SOAP fault",
      codeMatch ? codeMatch[1].trim() : null
    );
  }

  if (!response.ok) {
    throw new CrmProtocolError(`CRM returned HTTP ${response.status} with no SOAP fault`);
  }

  return text;
}

/**
 * Parse a SOAP response XML string into a JS object using fast-xml-parser.
 * Namespaces are stripped (`s:Envelope` → `Envelope`) so callers can write
 * simple property accesses like `parsed.Envelope.Body.ExecuteResponse...`.
 */
export function parseSoapResponse(xml: string): Record<string, unknown> {
  try {
    return PARSER.parse(xml) as Record<string, unknown>;
  } catch (cause) {
    throw new CrmProtocolError("Failed to parse SOAP response XML", { cause });
  }
}
