/**
 * SMS consent disclosure copy — extracted as plain-text constants so both the
 * React component (`sms-consent-checkbox.tsx`) and the Twilio TFV submission
 * script (`scripts/lib/tollfree-fields.ts`, Phase 6) read from the same source
 * of truth, and tests can assert on the required legal phrases without pulling
 * JSX into the vitest runner.
 *
 * DO NOT edit the label without bumping `SMS_CONSENT_VERSION` in
 * `src/lib/sms-consent.ts` AND resubmitting the toll-free verification. The
 * Twilio reviewer compares our live signup URLs against the submission's
 * `AdditionalInformation` field; wording drift causes rejection code 30475.
 */

export const SMS_CONSENT_LABEL_TEXT =
  "(Optional) I agree to receive transactional and conversational SMS messages from " +
  "Uplifter and the sports organizations I join, sent from a shared toll-free number. " +
  "Frequency varies; message & data rates may apply. Reply STOP to unsubscribe, HELP " +
  "for help. See the SMS section of our Terms of Service and our Privacy Policy.";

export const TERMS_OF_SERVICE_URL = "https://www.uplifterinc.com/terms-of-service";
export const PRIVACY_POLICY_URL = "https://www.uplifterinc.com/privacy-policy";
