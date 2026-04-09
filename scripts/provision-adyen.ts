/**
 * Adyen Local Webhook Provisioning Script
 *
 * Creates webhook subscriptions for a local development environment and
 * outputs the HMAC keys as a .env fragment. API credentials are shared
 * across all environments and must be obtained from a teammate — this
 * script does NOT create or rotate API keys.
 *
 * Uses the merchant-level Management API (`/v3/merchants/{id}/webhooks`)
 * because the company-level endpoint (`/v3/companies/{id}/webhooks`)
 * returns 422 for all operations on our account.
 *
 * Prerequisites:
 *   - ADYEN_API_KEY must be set in your .env (the shared checkout credential)
 *   - WEBHOOK_TUNNEL_URL should be set to your ngrok URL
 *
 * Usage:
 *   pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name>
 *   pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name> --dry-run
 *   pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name> --output .env.webhooks
 *
 * See: docs/adyen-platform/manual-credential-setup.md
 */

import * as fs from "fs";
import * as path from "path";

const dotenv = require("dotenv");
for (const envFile of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

const LOCAL_MERCHANT_ACCOUNT = "KirraCapital_Leapfrog_LOCAL_TEST";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--dev-tag" && args[i + 1]) {
      parsed.devTag = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      parsed.output = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }
  return parsed;
}

function printUsage() {
  console.log(`
Adyen Local Webhook Provisioning

Creates webhook subscriptions for local development and outputs HMAC keys.
Does NOT create or modify API credentials (those are shared).

Usage:
  pnpm dlx tsx scripts/provision-adyen.ts --dev-tag <your-name> [options]

Options:
  --dev-tag <name>   Your name/handle (used in webhook descriptions)
  --output <file>    Write HMAC keys to a file
  --dry-run          Preview what would be created
  --help             Show this help

Examples:
  pnpm dlx tsx scripts/provision-adyen.ts --dev-tag drew
  pnpm dlx tsx scripts/provision-adyen.ts --dev-tag drew --dry-run
  pnpm dlx tsx scripts/provision-adyen.ts --dev-tag drew --output .env.webhooks
`);
}

// ---------------------------------------------------------------------------
// Webhook definitions
// ---------------------------------------------------------------------------

interface WebhookSpec {
  label: string;
  urlPath: string;
  envKey: string;
  description: string;
}

function getWebhookSpecs(devTag: string): WebhookSpec[] {
  return [
    {
      label: "Standard Payment Webhook",
      urlPath: "/api/webhooks/adyen",
      envKey: "ADYEN_WEBHOOK_HMAC_KEY",
      description: `Standard payment events - local-${devTag}`,
    },
    {
      label: "Balance Platform - Configuration",
      urlPath: "/api/webhooks/adyen-balance-platform",
      envKey: "ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY",
      description: `Configuration webhook - local-${devTag}`,
    },
    {
      label: "Balance Platform - Transfers",
      urlPath: "/api/webhooks/adyen-balance-platform",
      envKey: "ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY",
      description: `Transfer webhook - local-${devTag}`,
    },
    {
      label: "Balance Platform - Negative Balance",
      urlPath: "/api/webhooks/adyen-balance-platform",
      envKey: "ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY",
      description: `Negative Balance Compensation Warning - local-${devTag}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const DRY_RUN = !!args.dryRun;
  const devTag = args.devTag as string | undefined;

  if (!devTag) {
    console.error("ERROR: --dev-tag <your-name> is required.");
    console.error("       Example: pnpm dlx tsx scripts/provision-adyen.ts --dev-tag drew");
    process.exit(1);
  }

  const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
  if (!ADYEN_API_KEY) {
    console.error("ERROR: ADYEN_API_KEY is not set in your .env file.");
    console.error("       Get the shared checkout key from a teammate.");
    process.exit(1);
  }

  const tunnelUrl = process.env.WEBHOOK_TUNNEL_URL;
  if (!tunnelUrl) {
    console.error("ERROR: WEBHOOK_TUNNEL_URL is not set in your .env file.");
    console.error("       Start ngrok (ngrok http 3000) and set WEBHOOK_TUNNEL_URL to the URL.");
    process.exit(1);
  }

  console.log("===========================================");
  console.log("  Adyen Local Webhook Provisioning");
  console.log(`  Developer:        ${devTag}`);
  console.log(`  Tunnel URL:       ${tunnelUrl}`);
  console.log(`  Merchant account: ${LOCAL_MERCHANT_ACCOUNT}`);
  if (DRY_RUN) console.log("  MODE: DRY RUN");
  console.log("===========================================\n");

  const { Client, ManagementAPI } = require("@adyen/api-library");
  const client = new Client({ apiKey: ADYEN_API_KEY, environment: "TEST" });
  const mgmt = new ManagementAPI(client);

  // Step 1: Verify merchant account exists
  console.log("[Step 1/3] Verifying merchant account...");
  try {
    const merchant = await mgmt.AccountMerchantLevelApi.getMerchantAccount(LOCAL_MERCHANT_ACCOUNT);
    console.log(`  Found: ${merchant.id} (${merchant.name || ""})\n`);
  } catch {
    console.error(`ERROR: Merchant account ${LOCAL_MERCHANT_ACCOUNT} not found or not accessible.`);
    console.error("       Check that your ADYEN_API_KEY has access to this account.");
    process.exit(1);
  }

  // Step 2: Create or reuse webhooks (merchant-level API)
  console.log("[Step 2/3] Setting up webhooks...\n");

  const webhookSpecs = getWebhookSpecs(devTag);
  const existingWebhooks =
    await mgmt.WebhooksMerchantLevelApi.listAllWebhooks(LOCAL_MERCHANT_ACCOUNT);
  const existingList: any[] = (existingWebhooks.data || []).filter((wh: any) => wh.active);

  const generatedKeys: Record<string, string> = {};

  for (const spec of webhookSpecs) {
    const fullUrl = `${tunnelUrl}${spec.urlPath}`;
    console.log(`  ${spec.label}`);
    console.log(`    URL: ${fullUrl}`);
    console.log(`    Description: ${spec.description}`);

    const existing = existingList.find(
      (wh: any) => wh.url === fullUrl && wh.description === spec.description
    );

    if (existing) {
      console.log(`    Reusing existing webhook: ${existing.id}`);
      if (!DRY_RUN) {
        const hmac = await mgmt.WebhooksMerchantLevelApi.generateHmacKey(
          LOCAL_MERCHANT_ACCOUNT,
          existing.id
        );
        generatedKeys[spec.envKey] = hmac.hmacKey;
        console.log(`    HMAC regenerated: ${hmac.hmacKey.substring(0, 12)}...`);
      } else {
        generatedKeys[spec.envKey] = "DRY_RUN_PLACEHOLDER";
        console.log(`    [dry-run] Would regenerate HMAC key`);
      }
    } else {
      if (DRY_RUN) {
        console.log(`    [dry-run] Would create webhook`);
        generatedKeys[spec.envKey] = "DRY_RUN_PLACEHOLDER";
      } else {
        try {
          const webhook = await mgmt.WebhooksMerchantLevelApi.setUpWebhook(LOCAL_MERCHANT_ACCOUNT, {
            type: "standard",
            url: fullUrl,
            active: true,
            communicationFormat: "json",
            description: spec.description,
          });
          console.log(`    Created: ${webhook.id}`);

          const hmac = await mgmt.WebhooksMerchantLevelApi.generateHmacKey(
            LOCAL_MERCHANT_ACCOUNT,
            webhook.id
          );
          generatedKeys[spec.envKey] = hmac.hmacKey;
          console.log(`    HMAC: ${hmac.hmacKey.substring(0, 12)}...`);
        } catch (error: any) {
          console.error(`    ERROR: ${error.message || error}`);
          if (error.responseBody) {
            console.error(`    Response: ${error.responseBody}`);
          }
        }
      }
    }
    console.log();
  }

  // Step 3: Output
  console.log("[Step 3/3] Output...\n");

  const envLines: string[] = [];
  const keyOrder = [
    "ADYEN_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY",
  ];

  for (const key of keyOrder) {
    if (generatedKeys[key]) {
      envLines.push(`${key}=${generatedKeys[key]}`);
    }
  }

  const envFragment = envLines.join("\n");

  if (args.output && typeof args.output === "string" && !DRY_RUN) {
    fs.writeFileSync(args.output as string, envFragment + "\n");
    console.log(`  Written to ${args.output}\n`);
  }

  console.log("--- Webhook HMAC keys (.env fragment) ---");
  for (const line of envLines) {
    const [key, val] = line.split("=");
    const display = DRY_RUN ? "[dry-run]" : val;
    console.log(`  ${key}=${display}`);
  }

  console.log("\n===========================================");
  console.log("  Done!");
  console.log("===========================================");
  console.log(`  Webhooks created: ${webhookSpecs.length}`);
  console.log(`  All scoped to merchant: ${LOCAL_MERCHANT_ACCOUNT}`);
  console.log();
  console.log("  Next steps:");
  console.log("    1. Copy the HMAC keys above into your .env");
  console.log("    2. Restart your dev server");
  console.log("    3. Send a test event from the Adyen Customer Area to verify");
  console.log();
}

main().catch((error) => {
  console.error("Provisioning failed:", error);
  process.exit(1);
});
