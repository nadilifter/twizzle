import type { Metadata } from "next";
import Link from "next/link";
import { SmsConsentCheckbox } from "@/components/sms-consent-checkbox";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/components/sms-consent-copy";

/**
 * Public SMS opt-in disclosure page.
 *
 * Exists primarily so the URL we submit to Twilio as `OptInImageUrls` in a
 * Toll-Free Verification renders an immediately-visible, unchecked SMS
 * consent checkbox with the exact disclosure copy guardians see in the real
 * signup flow. The real signup form gates this checkbox behind email
 * verification (step 3 of 3), which Twilio reviewers cannot complete.
 *
 * This page renders the live `<SmsConsentCheckbox>` component — NOT a
 * screenshot — so it stays in sync with the real UI automatically. The
 * checkbox is disabled because this page is a disclosure, not an actual
 * opt-in surface (real opt-in happens on the signup form and in account
 * settings, where it is persisted server-side).
 *
 * DO NOT delete or rename this page without coordinating a new TFV submission
 * with the corrected URL — the canonical opt-in URL lives in env vars
 * (`TWILIO_TFV_OPTIN_URL_PRIMARY`) and is referenced by Twilio.
 */

export const metadata: Metadata = {
  title: "SMS Messaging Disclosure — Uplifter",
  description:
    "Details of Uplifter's SMS messaging program and the opt-in experience shown to parents and athletes at signup.",
};

export default function SmsOptInPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">SMS Messaging Disclosure</h1>
        <p className="mt-3 text-muted-foreground">
          This page documents Uplifter&apos;s SMS opt-in experience. It is provided as a stable
          public reference for compliance reviewers. The checkbox below is the exact control
          guardians see when signing up on any Uplifter-hosted club site.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">The opt-in checkbox</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This is the unchecked-by-default control rendered on every Uplifter signup surface.
          Checking it is optional — account creation succeeds whether or not it is checked. Only
          users who explicitly check this box have an SMS consent timestamp recorded against their
          account, and the Uplifter server refuses to deliver SMS to any user without that
          timestamp.
        </p>
        <div className="rounded-lg border bg-card p-6">
          <SmsConsentCheckbox checked={false} disabled />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          This page&apos;s checkbox is disabled — it is a disclosure, not a persistent opt-in.
          Guardians interact with an identical, enabled checkbox on their club&apos;s signup page
          and on their account settings page.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">Where this appears in the real flow</h2>
        <ol className="list-decimal pl-5 space-y-3 text-sm text-muted-foreground">
          <li>
            A parent or athlete (&quot;guardian&quot;) visits their club&apos;s Uplifter-hosted
            marketing site and clicks <em>Sign Up</em>.
          </li>
          <li>
            They enter their email address and receive a one-time verification code via email. They
            enter the code to prove ownership of the email address.
          </li>
          <li>
            They complete the signup form: name, password, and two separate checkboxes — (a) Terms
            of Service + Privacy Policy acceptance, and (b) the optional SMS messaging consent shown
            above. The Terms checkbox gates form submission; the SMS checkbox does not.
          </li>
          <li>
            After signup, guardians can change their SMS preference at any time from their account
            settings. Replying <code>STOP</code> to any message also immediately opts them out and
            clears their consent record on Uplifter&apos;s servers.
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3">SMS program details</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium">Brand</dt>
            <dd className="text-muted-foreground">
              Uplifter, on behalf of the sports clubs a guardian has joined.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Message types</dt>
            <dd className="text-muted-foreground">
              Transactional and conversational: registration confirmations, schedule alerts, billing
              reminders, and two-way messages from club staff.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Frequency</dt>
            <dd className="text-muted-foreground">
              Varies by club — typically up to ~10 messages per week per organization.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Cost</dt>
            <dd className="text-muted-foreground">
              Message and data rates may apply. Guardians are responsible for their carrier plan
              charges.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Opt-out</dt>
            <dd className="text-muted-foreground">
              Reply <code>STOP</code> to any message, or toggle SMS off in account settings.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Help</dt>
            <dd className="text-muted-foreground">
              Reply <code>HELP</code>, contact your organization, or email{" "}
              <a
                href="mailto:support@uplifterinc.com"
                className="text-primary hover:underline font-medium"
              >
                support@uplifterinc.com
              </a>
              .
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Legal</h2>
        <p className="text-sm text-muted-foreground">
          The full messaging policy is part of Uplifter&apos;s{" "}
          <Link href={TERMS_OF_SERVICE_URL} className="text-primary hover:underline font-medium">
            Terms of Service
          </Link>
          . Handling of phone numbers and message content is governed by our{" "}
          <Link href={PRIVACY_POLICY_URL} className="text-primary hover:underline font-medium">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
