"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/components/sms-consent-copy";

/**
 * SMS Consent Checkbox
 *
 * Standalone, unchecked-by-default opt-in rendered on every signup surface and
 * in account settings. The label copy is fixed and lives in `sms-consent-copy.ts`
 * (shared with tests and the Twilio TFV submission script) — changing it can
 * invalidate the Twilio TFV approval, because reviewers load our live signup URLs
 * and compare them against the `AdditionalInformation` field of the submission.
 *
 * Rules for consumers:
 *  - Do NOT gate form submission on this checkbox being checked. SMS consent
 *    must be truly optional (Twilio 30475: consent cannot be a requirement of
 *    service).
 *  - Do NOT render this inside the same `<label>` as a Terms/Privacy checkbox.
 *    It must be visually and structurally a separate control.
 *  - Do NOT pre-check it. The initial state MUST be false.
 *  - Do NOT change the label text without coordinating a new TFV submission
 *    (and bumping `SMS_CONSENT_VERSION` in `src/lib/sms-consent.ts`).
 */

export interface SmsConsentCheckboxProps {
  /** Current checked state. Consumers own this — render `false` on mount. */
  checked: boolean;
  /** Called with the new checked state when the user toggles the checkbox. */
  onChange: (checked: boolean) => void;
  /** Disable the control (e.g., while a form is submitting). */
  disabled?: boolean;
  /** Suffix appended to `sms-consent` for the input/label `id`. Useful when
   *  rendering more than one instance on the same page. */
  idSuffix?: string;
  /** Optional wrapper className. */
  className?: string;
}

export function SmsConsentCheckbox({
  checked,
  onChange,
  disabled,
  idSuffix,
  className,
}: SmsConsentCheckboxProps) {
  const id = idSuffix ? `sms-consent-${idSuffix}` : "sms-consent";

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
        disabled={disabled}
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-sm leading-snug text-muted-foreground cursor-pointer">
        (Optional) I agree to receive transactional and conversational SMS messages from Uplifter
        and the sports organizations I join, sent from a shared toll-free number. Frequency varies;
        message & data rates may apply. Reply STOP to unsubscribe, HELP for help. See the SMS
        section of our{" "}
        <a
          href={TERMS_OF_SERVICE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          Terms of Service
        </a>{" "}
        and our{" "}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          Privacy Policy
        </a>
        .
      </label>
    </div>
  );
}
