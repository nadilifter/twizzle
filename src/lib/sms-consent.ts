import type { SmsConsentRevokeSource, SmsConsentSource } from "@prisma/client";

/**
 * SMS Consent tracking (TCPA / Twilio toll-free compliance)
 *
 * Bumping the version signals a material change to the disclosure copy and
 * forces users to re-affirm consent. Keep in sync with the label text in
 * `<SmsConsentCheckbox>` and the inline disclosure on signup surfaces.
 */
export const SMS_CONSENT_VERSION = "2026-04-v1";

export interface SmsConsentGrant {
  smsConsentAt: Date;
  smsConsentSource: SmsConsentSource;
  smsConsentIp: string | null;
  smsConsentVersion: string;
  smsOptOut: false;
  smsOptOutAt: null;
}

/**
 * Build the Prisma `data` patch for granting SMS consent. Granting consent
 * also clears any prior opt-out (e.g., a user who previously texted STOP
 * and now re-opts-in through the UI).
 */
export function buildSmsConsentGrant(source: SmsConsentSource, ip: string | null): SmsConsentGrant {
  return {
    smsConsentAt: new Date(),
    smsConsentSource: source,
    smsConsentIp: ip,
    smsConsentVersion: SMS_CONSENT_VERSION,
    smsOptOut: false,
    smsOptOutAt: null,
  };
}

export interface SmsConsentRevoke {
  smsConsentAt: null;
  smsConsentSource: null;
  smsConsentIp: null;
  smsConsentVersion: null;
  smsConsentRevokeSource: SmsConsentRevokeSource;
  smsOptOut: true;
  smsOptOutAt: Date;
}

/**
 * Build the Prisma `data` patch for revoking SMS consent. Revocation is a
 * stronger signal than never having consented: we both clear the timestamp
 * and set the opt-out flag, so inbound STOP and UI revocation converge on
 * the same resting state. The `source` is persisted so Phase 5's STOP
 * handler can be distinguished from UI-initiated revocation after the fact.
 */
export function buildSmsConsentRevoke(source: SmsConsentRevokeSource): SmsConsentRevoke {
  return {
    smsConsentAt: null,
    smsConsentSource: null,
    smsConsentIp: null,
    smsConsentVersion: null,
    smsConsentRevokeSource: source,
    smsOptOut: true,
    smsOptOutAt: new Date(),
  };
}
