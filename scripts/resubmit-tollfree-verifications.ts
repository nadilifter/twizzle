/**
 * Bulk-resubmit all TWILIO_REJECTED toll-free verifications with the current
 * canonical field set. Used to get rejected numbers back into Twilio's
 * priority resubmission queue (7-day window from rejection date).
 *
 * Usage:
 *   pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts
 *   DRY_RUN=1 pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts
 *   pnpm dlx tsx scripts/resubmit-tollfree-verifications.ts --sid HH7d17f...
 *
 * Env vars: same as `scripts/provision-tollfree-number.ts`. See
 * `scripts/lib/tollfree-fields.ts` for the full list.
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

const dotenv = require("dotenv");
for (const envFile of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

// Twilio caps EditReason at ~100 chars (400 Invalid edit reason beyond that).
const EDIT_REASON =
  "Corrected opt-in URL to standalone consent page; role-based contact email and business phone.";

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const SPECIFIC_SID = parseArg("--sid");
const DRY_RUN = process.env.DRY_RUN === "1";

async function main(): Promise<void> {
  console.log("Twilio Toll-Free Verification Resubmission");
  console.log("=".repeat(60));
  console.log(`Account SID: ${process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`Dry run:     ${DRY_RUN ? "yes" : "no"}`);
  if (SPECIFIC_SID) console.log(`Locked SID:  ${SPECIFIC_SID}`);
  console.log("=".repeat(60));

  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.error("\nEnvironment validation failed:");
    for (const e of envErrors) console.error(`  - ${e.field}: ${e.reason}`);
    process.exit(1);
  }

  console.log("\nChecking opt-in URLs are reachable...");
  const urlErrors = await validateOptInUrlsReachable();
  if (urlErrors.length > 0) {
    console.error("\nOpt-in URL reachability check failed:");
    for (const e of urlErrors) console.error(`  - ${e.field}: ${e.reason}`);
    process.exit(1);
  }
  console.log("  ...OK");

  const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

  // Collect targets
  let targets: Array<{ sid: string; phone: string }>;
  if (SPECIFIC_SID) {
    const v = await client.messaging.v1.tollfreeVerifications(SPECIFIC_SID).fetch();
    targets = [{ sid: v.sid, phone: v.tollfreePhoneNumber }];
  } else {
    console.log("\nFetching all toll-free verifications...");
    // Twilio's Tollfree endpoint caps PageSize at 50; the SDK's default is higher, so set it explicitly.
    const all = await client.messaging.v1.tollfreeVerifications.list({ limit: 500, pageSize: 50 });
    const rejected = all.filter((v) => v.status === "TWILIO_REJECTED");
    console.log(`  Total verifications: ${all.length}`);
    console.log(`  Rejected:            ${rejected.length}`);
    targets = rejected.map((v) => ({ sid: v.sid, phone: v.tollfreePhoneNumber }));
  }

  if (targets.length === 0) {
    console.log("\nNothing to resubmit.");
    return;
  }

  const fields = buildTollFreeFields();
  const payload = toTwilioPayload(fields);

  const auth = basicAuth(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);

  console.log("\nResubmitting:");
  for (const { sid, phone } of targets) {
    console.log(`\n  ${phone} (${sid})`);
    if (DRY_RUN) {
      console.log("    [DRY RUN] Would update with EditReason + canonical fields");
      continue;
    }
    try {
      const res = await fetch(`https://messaging.twilio.com/v1/Tollfree/Verifications/${sid}`, {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: toFormBody({ ...payload, EditReason: EDIT_REASON }).toString(),
      });
      const body = (await res.json()) as { status?: string; message?: string };
      if (!res.ok) {
        console.error(`    Failed (${res.status}): ${JSON.stringify(body)}`);
      } else {
        console.log(`    Status: ${body.status}`);
      }
    } catch (err) {
      console.error(`    Failed: ${(err as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Done.");
  console.log("Monitor Twilio Console → Trust Hub → Toll-Free Verifications.");
}

main().catch((err) => {
  console.error("\nResubmission failed:", err);
  process.exit(1);
});
