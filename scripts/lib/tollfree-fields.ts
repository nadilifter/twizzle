/**
 * Canonical Twilio Toll-Free Verification (TFV) submission fields.
 *
 * Single source of truth for every field we send to Twilio's TFV API, read
 * from environment variables so personal contact information never sits in
 * git history. Consumed by:
 *   - scripts/provision-tollfree-number.ts   (new submissions)
 *   - scripts/resubmit-tollfree-verifications.ts  (edit previously rejected)
 *
 * IMPORTANT — updating this file:
 *   The opt-in disclosure copy (AdditionalInformation, UseCaseSummary,
 *   ProductionMessageSample) is what Twilio reviewers compare against the
 *   live signup URLs we submit in OptInImageUrls. Do NOT edit these fields
 *   without coordinating a fresh submission. The inline checkbox copy in
 *   `src/components/sms-consent-copy.ts` must also stay in sync.
 *
 * See `docs/sms-toll-free-verification.md` for the full context and
 * `~/.claude/plans/streamed-dancing-popcorn.md` for the broader overhaul.
 */

import { SMS_CONSENT_LABEL_TEXT } from "@/components/sms-consent-copy";

// ---------------------------------------------------------------------------
// Required env vars
// ---------------------------------------------------------------------------

export const REQUIRED_ENV_VARS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_CUSTOMER_PROFILE_SID",
  "TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME",
  "TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME",
  "TWILIO_TFV_BUSINESS_CONTACT_EMAIL",
  "TWILIO_TFV_BUSINESS_CONTACT_PHONE",
  "TWILIO_TFV_NOTIFICATION_EMAIL",
  "TWILIO_TFV_OPTIN_URL_PRIMARY",
] as const;

export const OPTIONAL_ENV_VARS = [
  "TWILIO_TFV_OPTIN_URL_SECONDARY",
  "TWILIO_TFV_BUSINESS_WEBSITE",
  "TWILIO_TFV_BUSINESS_STREET_ADDRESS",
  "TWILIO_TFV_BUSINESS_CITY",
  "TWILIO_TFV_BUSINESS_STATE_PROVINCE",
  "TWILIO_TFV_BUSINESS_POSTAL_CODE",
  "TWILIO_TFV_BUSINESS_REGISTRATION_NUMBER",
] as const;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  reason: string;
}

// Consumer/free-mail domains that should never appear as BusinessContactEmail.
const PERSONAL_EMAIL_DOMAINS = [
  "@gmail.com",
  "@googlemail.com",
  "@outlook.com",
  "@hotmail.com",
  "@live.com",
  "@yahoo.com",
  "@icloud.com",
  "@me.com",
  "@aol.com",
  "@proton.me",
  "@protonmail.com",
];

// Hosts Twilio reviewers cannot load — either private (localhost) or
// auth-gated (our dev subdomain). If these slip into an opt-in URL, Twilio
// will reject with 30475 or "URL not reachable".
const UNREACHABLE_URL_SUBSTRINGS = [
  "http://localhost",
  "https://localhost",
  "127.0.0.1",
  "upliftergymnastics-dev.com",
];

/** Collect validation errors for the required env vars. */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const name of REQUIRED_ENV_VARS) {
    const value = env[name];
    if (!value || value.trim().length === 0) {
      errors.push({ field: name, reason: "missing or empty" });
    }
  }

  // Early-out — downstream checks require these to be set.
  if (errors.length > 0) return errors;

  const email = env.TWILIO_TFV_BUSINESS_CONTACT_EMAIL!.toLowerCase();
  if (PERSONAL_EMAIL_DOMAINS.some((d) => email.endsWith(d))) {
    errors.push({
      field: "TWILIO_TFV_BUSINESS_CONTACT_EMAIL",
      reason: `appears to be a personal address (${email}). Use a role-based email like compliance@uplifterinc.com.`,
    });
  }

  const notifyEmail = env.TWILIO_TFV_NOTIFICATION_EMAIL!.toLowerCase();
  if (PERSONAL_EMAIL_DOMAINS.some((d) => notifyEmail.endsWith(d))) {
    errors.push({
      field: "TWILIO_TFV_NOTIFICATION_EMAIL",
      reason: `appears to be a personal address (${notifyEmail}). Use a role-based email.`,
    });
  }

  // BusinessContactEmail should not contain the contact's own name — that
  // strongly implies it is a personal inbox (e.g. "andrew.karzel@...").
  const firstName = env.TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME!.toLowerCase();
  const lastName = env.TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME!.toLowerCase();
  const localPart = email.split("@")[0] ?? "";
  if (
    (firstName.length >= 3 && localPart.includes(firstName)) ||
    (lastName.length >= 3 && localPart.includes(lastName))
  ) {
    errors.push({
      field: "TWILIO_TFV_BUSINESS_CONTACT_EMAIL",
      reason: `contains the contact's first/last name (${localPart}) — use a role-based email instead of a personal one.`,
    });
  }

  const primary = env.TWILIO_TFV_OPTIN_URL_PRIMARY!;
  if (UNREACHABLE_URL_SUBSTRINGS.some((s) => primary.includes(s))) {
    errors.push({
      field: "TWILIO_TFV_OPTIN_URL_PRIMARY",
      reason: `points at a non-public host (${primary}). Twilio reviewers must be able to load this without authentication.`,
    });
  }

  if (!primary.startsWith("https://")) {
    errors.push({
      field: "TWILIO_TFV_OPTIN_URL_PRIMARY",
      reason: `must be https:// (got ${primary}).`,
    });
  }

  const secondary = env.TWILIO_TFV_OPTIN_URL_SECONDARY;
  if (secondary) {
    if (UNREACHABLE_URL_SUBSTRINGS.some((s) => secondary.includes(s))) {
      errors.push({
        field: "TWILIO_TFV_OPTIN_URL_SECONDARY",
        reason: `points at a non-public host (${secondary}).`,
      });
    }
    if (!secondary.startsWith("https://")) {
      errors.push({
        field: "TWILIO_TFV_OPTIN_URL_SECONDARY",
        reason: `must be https:// (got ${secondary}).`,
      });
    }
  }

  return errors;
}

/** HEAD-check opt-in URLs to ensure Twilio reviewers will be able to load them. */
export async function validateOptInUrlsReachable(
  env: NodeJS.ProcessEnv = process.env
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  const urls: Array<{ field: string; url: string }> = [];
  if (env.TWILIO_TFV_OPTIN_URL_PRIMARY) {
    urls.push({ field: "TWILIO_TFV_OPTIN_URL_PRIMARY", url: env.TWILIO_TFV_OPTIN_URL_PRIMARY });
  }
  if (env.TWILIO_TFV_OPTIN_URL_SECONDARY) {
    urls.push({ field: "TWILIO_TFV_OPTIN_URL_SECONDARY", url: env.TWILIO_TFV_OPTIN_URL_SECONDARY });
  }

  await Promise.all(
    urls.map(async ({ field, url }) => {
      try {
        // Some hosts reject HEAD; fall back to GET if we see a 4xx/5xx that
        // isn't a typical auth response. Twilio reviewers use a browser, so
        // a 200 from GET is the right signal.
        const res = await fetch(url, { method: "GET", redirect: "follow" });
        if (!res.ok) {
          errors.push({
            field,
            reason: `GET ${url} returned ${res.status}. Twilio reviewers must get a 2xx.`,
          });
        }
      } catch (err) {
        errors.push({
          field,
          reason: `GET ${url} failed: ${(err as Error).message}`,
        });
      }
    })
  );

  return errors;
}

// ---------------------------------------------------------------------------
// Canonical field builder
// ---------------------------------------------------------------------------

/**
 * Copy submitted to Twilio's `AdditionalInformation` field. Reviewer-facing
 * description of *how* consent is collected and enforced. Must match the
 * actual code behavior — keep in sync with:
 *   - Phase 3 signup surfaces (separate unchecked checkbox)
 *   - Phase 5 send-gate (refuses sends without smsConsentAt)
 *   - Phase 5 inbound STOP handler (clears smsConsentAt)
 */
const ADDITIONAL_INFORMATION = [
  "Users sign up on our web app using email and password.",
  "On every signup surface they see a SEPARATE, UNCHECKED SMS consent checkbox below the standard terms-of-service checkbox.",
  "SMS consent is optional — account creation succeeds whether or not it is checked.",
  "Only users who explicitly check the SMS box have `smsConsentAt` recorded in our database.",
  "Our server refuses to send SMS to any user without that timestamp.",
  "Users can revoke consent at any time from account settings or by replying STOP to any message (STOP clears both the opt-in timestamp and sets an opt-out flag).",
  "The exact on-page disclosure shown at opt-in is: " + JSON.stringify(SMS_CONSENT_LABEL_TEXT),
].join(" ");

const USE_CASE_SUMMARY = [
  "Uplifter is a B2B2C sports club management platform.",
  "Parents and athletes consent once to receive SMS from Uplifter and any organization they join.",
  "Messages are sent from a pool of toll-free numbers; each user is assigned a sticky number per organization so two-way conversations route correctly.",
  "Use cases: registration confirmations, schedule alerts, billing reminders, coach-to-parent messages.",
].join(" ");

const PRODUCTION_MESSAGE_SAMPLE =
  "Uplifter (Downtown Soccer Club): Hi Jane, your registration for Summer Camp is confirmed. First session Mon Jun 15 9:00 AM. Reply STOP to opt out, HELP for help.";

const HELP_MESSAGE_SAMPLE =
  "Reply STOP to unsubscribe. For help, contact your organization or email support@uplifterinc.com.";

export interface TollFreeVerificationFields {
  // Business identity
  BusinessName: string;
  BusinessWebsite: string;
  BusinessStreetAddress?: string;
  BusinessCity?: string;
  BusinessStateProvinceRegion?: string;
  BusinessPostalCode?: string;
  BusinessCountry: string;
  BusinessType: string;
  BusinessRegistrationNumber?: string;
  BusinessRegistrationAuthority?: string;
  BusinessRegistrationCountry?: string;

  // Contact (role-based)
  BusinessContactFirstName: string;
  BusinessContactLastName: string;
  BusinessContactEmail: string;
  BusinessContactPhone: string;
  NotificationEmail: string;

  // Customer Profile linkage
  CustomerProfileSid: string;

  // Messaging policy
  OptInType: "WEB_FORM";
  OptInImageUrls: string[];
  UseCaseSummary: string;
  UseCaseCategories: string[];
  ProductionMessageSample: string;
  HelpMessageSample: string;
  AdditionalInformation: string;
  PrivacyPolicyUrl: string;
  TermsAndConditionsUrl: string;
  AgeGatedContent: boolean;
  MessageVolume: string;
}

/** Build the canonical TFV field map from environment variables. Throws if env is invalid. */
export function buildTollFreeFields(
  env: NodeJS.ProcessEnv = process.env
): TollFreeVerificationFields {
  const errors = validateEnv(env);
  if (errors.length > 0) {
    const lines = errors.map((e) => `  - ${e.field}: ${e.reason}`).join("\n");
    throw new Error(`Invalid TFV environment variables:\n${lines}`);
  }

  const optInUrls = [env.TWILIO_TFV_OPTIN_URL_PRIMARY!];
  if (env.TWILIO_TFV_OPTIN_URL_SECONDARY) {
    optInUrls.push(env.TWILIO_TFV_OPTIN_URL_SECONDARY);
  }

  return {
    BusinessName: "Uplifter LLC",
    BusinessWebsite: env.TWILIO_TFV_BUSINESS_WEBSITE ?? "https://www.uplifterinc.com/",
    BusinessStreetAddress: env.TWILIO_TFV_BUSINESS_STREET_ADDRESS,
    BusinessCity: env.TWILIO_TFV_BUSINESS_CITY,
    BusinessStateProvinceRegion: env.TWILIO_TFV_BUSINESS_STATE_PROVINCE,
    BusinessPostalCode: env.TWILIO_TFV_BUSINESS_POSTAL_CODE,
    BusinessCountry: "US",
    BusinessType: "PRIVATE_PROFIT",
    BusinessRegistrationNumber: env.TWILIO_TFV_BUSINESS_REGISTRATION_NUMBER,
    BusinessRegistrationAuthority: env.TWILIO_TFV_BUSINESS_REGISTRATION_NUMBER ? "EIN" : undefined,
    BusinessRegistrationCountry: env.TWILIO_TFV_BUSINESS_REGISTRATION_NUMBER ? "US" : undefined,

    BusinessContactFirstName: env.TWILIO_TFV_BUSINESS_CONTACT_FIRST_NAME!,
    BusinessContactLastName: env.TWILIO_TFV_BUSINESS_CONTACT_LAST_NAME!,
    BusinessContactEmail: env.TWILIO_TFV_BUSINESS_CONTACT_EMAIL!,
    BusinessContactPhone: env.TWILIO_TFV_BUSINESS_CONTACT_PHONE!,
    NotificationEmail: env.TWILIO_TFV_NOTIFICATION_EMAIL!,

    CustomerProfileSid: env.TWILIO_CUSTOMER_PROFILE_SID!,

    OptInType: "WEB_FORM",
    OptInImageUrls: optInUrls,
    UseCaseSummary: USE_CASE_SUMMARY,
    UseCaseCategories: ["ACCOUNT_NOTIFICATIONS", "CUSTOMER_CARE"],
    ProductionMessageSample: PRODUCTION_MESSAGE_SAMPLE,
    HelpMessageSample: HELP_MESSAGE_SAMPLE,
    AdditionalInformation: ADDITIONAL_INFORMATION,
    PrivacyPolicyUrl: "https://www.uplifterinc.com/privacy-policy",
    TermsAndConditionsUrl: "https://www.uplifterinc.com/terms-of-service",
    AgeGatedContent: false,
    MessageVolume: "10,000",
  };
}

/** Strip undefined values so Twilio's SDK doesn't serialize them as "undefined". */
export function toTwilioPayload(
  fields: TollFreeVerificationFields
): Record<string, string | string[] | boolean> {
  const out: Record<string, string | string[] | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
