/**
 * Provision a new Twilio toll-free number end-to-end:
 *   1. Search available US toll-free numbers (or use --number to lock one).
 *   2. Purchase the number.
 *   3. Attach it to the Messaging Service.
 *   4. Submit a Toll-Free Verification (TFV) using the canonical field map.
 *
 * Usage:
 *   pnpm dlx tsx scripts/provision-tollfree-number.ts
 *   pnpm dlx tsx scripts/provision-tollfree-number.ts --number +18881234567
 *   DRY_RUN=1 pnpm dlx tsx scripts/provision-tollfree-number.ts
 *
 * Env vars (see `scripts/lib/tollfree-fields.ts`):
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID,
 *   TWILIO_CUSTOMER_PROFILE_SID, TWILIO_TFV_* (see .env.example)
 *
 * On success prints the new E.164 number, the HH verification SID, and a
 * reminder to add the number to SMS_PHONE_POOL in the target environment.
 * The pool manager holds back unverified numbers automatically (see
 * `src/lib/sms-number-pool.ts`), so a premature deploy of SMS_PHONE_POOL is
 * safe — numbers don't route traffic until Twilio flips status to
 * TWILIO_APPROVED.
 */

import * as fs from "fs";
import * as path from "path";
import twilio from "twilio";
import {
  buildTollFreeFields,
  toTwilioPayload,
  validateEnv,
  validateOptInUrlsReachable,
} from "./lib/tollfree-fields";

/**
 * Build URL-encoded form body from our PascalCase field map. Twilio's TFV
 * endpoint expects form-urlencoded with PascalCase names; the JS SDK's
 * camelCase type layer is a convenience wrapper over the same REST API.
 * Using fetch directly avoids SDK type drift as new fields are added.
 */
function toFormBody(payload: Record<string, string | string[] | boolean>): URLSearchParams {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      for (const v of value) form.append(key, v);
    } else if (typeof value === "boolean") {
      form.append(key, value ? "true" : "false");
    } else {
      form.append(key, value);
    }
  }
  return form;
}

function basicAuth(accountSid: string, authToken: string): string {
  return "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
}

// Load env files (raw dotenv — no dotenv-expand — so `$` in secrets is preserved).
const dotenv = require("dotenv");
for (const envFile of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const SPECIFIC_NUMBER = parseArg("--number");
const DRY_RUN = process.env.DRY_RUN === "1";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Twilio Toll-Free Number Provisioning");
  console.log("=".repeat(60));
  console.log(`Account SID:           ${process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`Messaging Service SID: ${process.env.TWILIO_MESSAGING_SERVICE_SID}`);
  console.log(`Customer Profile SID:  ${process.env.TWILIO_CUSTOMER_PROFILE_SID}`);
  console.log(`Dry run:               ${DRY_RUN ? "yes" : "no"}`);
  if (SPECIFIC_NUMBER) console.log(`Locked number:         ${SPECIFIC_NUMBER}`);
  console.log("=".repeat(60));

  // Hard-fail on bad env before hitting Twilio.
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("\nEnvironment validation failed:");
    for (const e of envErrors) console.error(`  - ${e.field}: ${e.reason}`);
    process.exit(1);
  }

  console.log("\nChecking opt-in URLs are reachable by Twilio reviewers...");
  const urlErrors = await validateOptInUrlsReachable();
  if (urlErrors.length > 0) {
    console.error("\nOpt-in URL reachability check failed:");
    for (const e of urlErrors) console.error(`  - ${e.field}: ${e.reason}`);
    process.exit(1);
  }
  console.log("  ...OK");

  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

  // 1. Choose a number
  let phoneNumber: string;
  if (SPECIFIC_NUMBER) {
    phoneNumber = SPECIFIC_NUMBER;
  } else {
    console.log("\n[1/4] Searching for an available US toll-free number...");
    const available = await client.availablePhoneNumbers("US").tollFree.list({ limit: 5 });
    if (available.length === 0) {
      console.error("No available toll-free numbers found.");
      process.exit(1);
    }
    console.log("  Available candidates:");
    for (const n of available) console.log(`    ${n.phoneNumber} (${n.friendlyName})`);
    phoneNumber = available[0].phoneNumber;
    console.log(`  Selected: ${phoneNumber}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Would purchase", phoneNumber);
  }

  // 2. Purchase
  console.log(`\n[2/4] Purchasing ${phoneNumber}...`);
  let phoneNumberSid: string;
  if (DRY_RUN) {
    phoneNumberSid = "PN00000000000000000000000000000000";
    console.log("  [DRY RUN] Skipping purchase; using fake PN SID");
  } else {
    const incoming = await client.incomingPhoneNumbers.create({ phoneNumber });
    phoneNumberSid = incoming.sid;
    console.log(`  Purchased: ${incoming.phoneNumber} (${incoming.sid})`);
  }

  // 3. Attach to Messaging Service
  console.log(`\n[3/4] Attaching ${phoneNumberSid} to Messaging Service...`);
  if (DRY_RUN) {
    console.log("  [DRY RUN] Skipping messaging service attach");
  } else {
    await client.messaging.v1
      .services(process.env.TWILIO_MESSAGING_SERVICE_SID!)
      .phoneNumbers.create({ phoneNumberSid });
    console.log("  Attached.");
  }

  // 4. Submit toll-free verification
  console.log("\n[4/4] Submitting toll-free verification...");
  const fields = buildTollFreeFields();
  const payload = {
    ...toTwilioPayload(fields),
    TollfreePhoneNumberSid: phoneNumberSid,
  };

  if (DRY_RUN) {
    console.log("  [DRY RUN] Payload that would be sent:");
    console.log(JSON.stringify(payload, null, 2));
    console.log("\nDone (dry run).");
    return;
  }

  const res = await fetch("https://messaging.twilio.com/v1/Tollfree/Verifications", {
    method: "POST",
    headers: {
      Authorization: basicAuth(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody(payload).toString(),
  });
  const body = (await res.json()) as { sid?: string; status?: string; message?: string };
  if (!res.ok) {
    throw new Error(`Twilio TFV submit failed (${res.status}): ${JSON.stringify(body)}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TFV submitted.");
  console.log(`  Phone:  ${phoneNumber}`);
  console.log(`  PN SID: ${phoneNumberSid}`);
  console.log(`  HH SID: ${body.sid}`);
  console.log(`  Status: ${body.status}`);
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log(`  1. Add ${phoneNumber} to SMS_PHONE_POOL in the target environment.`);
  console.log(
    "     The pool manager will hold the number back until Twilio flips status to TWILIO_APPROVED."
  );
  console.log("  2. Monitor Twilio Console → Trust Hub → Toll-Free Verifications.");
  console.log("     Approval typically takes 2-5 business days.");
}

main().catch((err) => {
  console.error("\nProvisioning failed:", err);
  process.exit(1);
});
