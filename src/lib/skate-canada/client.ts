// High-level Skate Canada CRM client. Wraps the SOAP transport in
// operation-specific methods that return typed JS objects.
//
// Phase 6.1 ships `getSeasons()` as proof; subsequent phases add:
//   6.2 — getContact, getSuggestedContacts, syncMemberNumber
//   6.3 — createMemberRegistration, getMemberRegistrationSubmission
//   6.4 — getSeasonFromGUID (already trivial here), checkParticipantSeasons
//   6.5 — checkCategories, skateCanadaCategories
//
// Each method:
//   1. Builds the operation-specific SOAP body fragment (mirrors the PHP
//      template strings; Dynamics 2011 envelopes are small + stable).
//   2. Calls executeSoap() to send it and get raw response XML.
//   3. Parses just the fields we need out of the XML using a local helper.

import { getConfig, type SkateCanadaConfig } from "./config";
import { executeSoap, parseSoapResponse, stripXmlWhitespace } from "./soap-client";
import { CrmProtocolError } from "./errors";
import type { SkateCanadaSeason } from "./types";

export interface SkateCanadaClientOptions {
  config?: SkateCanadaConfig;
  /** Override fetch (tests). */
  fetchImpl?: typeof fetch;
}

export class SkateCanadaClient {
  private config: SkateCanadaConfig;
  private fetchImpl: typeof fetch;

  constructor(options: SkateCanadaClientOptions = {}) {
    this.config = options.config ?? getConfig();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * List active Skate Canada seasons whose endDate is on/after `date`.
   * Mirrors PHP SkateCanadaApi::getSeasons() but does not write through to
   * a local cache — caller decides how (or whether) to persist.
   *
   * @param date  Optional ISO date string `yyyy-mm-dd` or a Date instance.
   *              Defaults to today UTC.
   */
  async getSeasons(date: string | Date = new Date()): Promise<SkateCanadaSeason[]> {
    const dateStr = formatDateUTC(date);
    const fetchXml = stripXmlWhitespace(`
      <fetch mapping="logical" count="1000" version="1.0">
        <entity name="sc_season">
          <attribute name="sc_name"/>
          <attribute name="sc_startdate"/>
          <attribute name="sc_enddate"/>
          <attribute name="statecode"/>
          <filter type="and">
            <condition attribute="sc_enddate" operator="ge" value="${escapeXmlAttr(dateStr)}"/>
            <condition attribute="statecode" operator="eq" value="0"/>
          </filter>
        </entity>
      </fetch>
    `);

    const bodyFragment = `<s:Body>
      <Execute xmlns="http://schemas.microsoft.com/xrm/2011/Contracts/Services">
        <request i:type="b:RetrieveMultipleRequest" xmlns:b="http://schemas.microsoft.com/xrm/2011/Contracts" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
          <b:Parameters xmlns:c="http://schemas.datacontract.org/2004/07/System.Collections.Generic">
            <b:KeyValuePairOfstringanyType>
              <c:key>Query</c:key>
              <c:value i:type="b:FetchExpression">
                <b:Query>${escapeXmlText(fetchXml)}</b:Query>
              </c:value>
            </b:KeyValuePairOfstringanyType>
          </b:Parameters>
          <b:RequestId i:nil="true"/>
          <b:RequestName>RetrieveMultiple</b:RequestName>
        </request>
      </Execute>
    </s:Body>`;

    const responseXml = await executeSoap(this.config, bodyFragment, {
      fetchImpl: this.fetchImpl,
    });

    return parseSeasonsResponse(responseXml);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateUTC(date: string | Date): string {
  if (typeof date === "string") return date;
  // yyyy-mm-dd in UTC. Avoid Intl/timezone surprises.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeXmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeXmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/**
 * Extract season rows from a RetrieveMultipleResponse SOAP response.
 *
 * The response shape (after namespace stripping) looks like:
 *   Envelope.Body.ExecuteResponse.ExecuteResult.Results.KeyValuePairOfstringanyType.value.Entities.Entity[]
 *
 * Each Entity has an Attributes child containing KeyValuePairOfstringanyType
 * rows where key = the CRM logical name. We map those to our domain shape.
 */
export function parseSeasonsResponse(xml: string): SkateCanadaSeason[] {
  const parsed = parseSoapResponse(xml);

  // Walk the canonical Dynamics path. Each layer may be missing if the
  // response is unexpectedly shaped — return [] rather than crashing so the
  // caller can fall back to local data.
  const entities = pickEntities(parsed);
  if (!entities.length) return [];

  return entities
    .map((entity) => entityToSeason(entity))
    .filter((s): s is SkateCanadaSeason => s !== null);
}

interface XmlObj {
  [key: string]: unknown;
}

function pickEntities(parsed: Record<string, unknown>): XmlObj[] {
  try {
    const envelope = parsed.Envelope as XmlObj;
    const body = envelope?.Body as XmlObj;
    const executeResponse = body?.ExecuteResponse as XmlObj;
    const executeResult = executeResponse?.ExecuteResult as XmlObj;

    // The Results element wraps a single KeyValuePairOfstringanyType whose
    // value carries the EntityCollection with the Entities array.
    const results = executeResult?.Results as XmlObj | undefined;
    if (!results) return [];

    const kvp = results.KeyValuePairOfstringanyType as XmlObj | undefined;
    if (!kvp) return [];

    const value = kvp.value as XmlObj | undefined;
    if (!value) return [];

    const entitiesWrap = value.Entities as XmlObj | undefined;
    if (!entitiesWrap) return [];

    const entityField = entitiesWrap.Entity;
    if (!entityField) return [];

    // fast-xml-parser collapses single-element arrays to a single object.
    // Normalize to array.
    return Array.isArray(entityField) ? (entityField as XmlObj[]) : [entityField as XmlObj];
  } catch (cause) {
    throw new CrmProtocolError("Unexpected SOAP response shape", { cause });
  }
}

/**
 * Pull a season out of one <Entity> element. Returns null if the entity
 * is missing required fields (id + name); the caller filters those out.
 */
function entityToSeason(entity: XmlObj): SkateCanadaSeason | null {
  const attrs = readAttributesMap(entity);
  const id = readEntityId(entity);
  if (!id) return null;

  const name = stringOrNull(attrs.get("sc_name"));
  if (!name) return null;

  const startDate = stringOrNull(attrs.get("sc_startdate"));
  const endDate = stringOrNull(attrs.get("sc_enddate"));
  const stateCode = numberOrUndefined(attrs.get("statecode"));

  return {
    id,
    name,
    startDate: startDate ?? "",
    endDate: endDate ?? "",
    ...(stateCode !== undefined ? { stateCode } : {}),
  };
}

/**
 * Build a Map<crmAttrName, value> from an <Entity>'s <Attributes> child.
 * KeyValuePairOfstringanyType is the standard wrapper Dynamics uses.
 */
function readAttributesMap(entity: XmlObj): Map<string, unknown> {
  const map = new Map<string, unknown>();
  const attrs = entity.Attributes as XmlObj | undefined;
  if (!attrs) return map;

  const kvps = attrs.KeyValuePairOfstringanyType;
  if (!kvps) return map;

  const list = Array.isArray(kvps) ? (kvps as XmlObj[]) : [kvps as XmlObj];
  for (const kvp of list) {
    const key = kvp.key as string | undefined;
    if (!key) continue;
    map.set(key, kvp.value);
  }
  return map;
}

function readEntityId(entity: XmlObj): string | null {
  const idField = entity.Id;
  if (typeof idField === "string") return idField;
  if (idField && typeof idField === "object" && "#text" in (idField as Record<string, unknown>)) {
    return String((idField as Record<string, unknown>)["#text"]);
  }
  return null;
}

function stringOrNull(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "#text" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)["#text"]);
  }
  return null;
}

function numberOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  if (v && typeof v === "object" && "Value" in (v as Record<string, unknown>)) {
    const inner = (v as Record<string, unknown>).Value;
    if (typeof inner === "number") return inner;
    if (typeof inner === "string") {
      const n = Number(inner);
      return Number.isFinite(n) ? n : undefined;
    }
  }
  return undefined;
}
