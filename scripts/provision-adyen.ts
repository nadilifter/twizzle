/**
 * Adyen Multi-Environment Provisioning Script
 *
 * Automates the creation of Adyen API credentials, webhook subscriptions,
 * and HMAC keys for any environment. Outputs a .env fragment that can be
 * piped to a file or deployed via SSH.
 *
 * Prerequisites:
 *   - ADYEN_API_KEY must be set in your local .env (company-scoped key with
 *     "Management API — API credentials read and write" role)
 *
 * Usage:
 *   npx tsx scripts/provision-adyen.ts --env staging
 *   npx tsx scripts/provision-adyen.ts --env production --output .env.adyen
 *   npx tsx scripts/provision-adyen.ts --env staging --dry-run
 *   npx tsx scripts/provision-adyen.ts --env staging --deploy-ssh uplifter-staging
 *
 * Replaces the older scripts/provision-adyen-staging.ts (which is kept for
 * backward compatibility but is no longer the preferred approach).
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Load env files with raw dotenv (no dotenv-expand) so API keys containing
// `$` are preserved. @next/env chains dotenv-expand which silently strips
// `$VAR` sequences even inside single-quoted values.
const dotenv = require("dotenv");
for (const envFile of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath });
  }
}

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

type Environment = "production" | "staging" | "development" | "local";

const ADMIN_URLS: Record<Environment, string> = {
  production: "https://admin.uplifter.app",
  staging: "https://admin.upliftergymnastics.com",
  development: "https://admin.uplifterdev.com",
  local: process.env.WEBHOOK_TUNNEL_URL || "http://localhost:3000",
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
    } else if (arg === "--env" && args[i + 1]) {
      parsed.env = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      parsed.output = args[++i];
    } else if (arg === "--deploy-ssh" && args[i + 1]) {
      parsed.deploySsh = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }
  return parsed;
}

function printUsage() {
  console.log(`
Adyen Multi-Environment Provisioning

Usage:
  npx tsx scripts/provision-adyen.ts --env <environment> [options]

Options:
  --env <env>          Target environment: production, staging, development, local
  --output <file>      Write generated .env fragment to file
  --deploy-ssh <host>  SSH to host and update ~/.env.uplifter
  --dry-run            Preview changes without creating anything
  --help               Show this help message

Examples:
  npx tsx scripts/provision-adyen.ts --env staging --dry-run
  npx tsx scripts/provision-adyen.ts --env staging --output .env.adyen
  npx tsx scripts/provision-adyen.ts --env production --deploy-ssh uplifter-prod
`);
}

// ---------------------------------------------------------------------------
// Credential definitions
// ---------------------------------------------------------------------------

interface CredentialSpec {
  label: string;
  description: string;
  envKeyApiKey: string;
  envKeyClientKey?: string;
  roles: string[];
}

const API_CREDENTIALS: CredentialSpec[] = [
  {
    label: "Checkout / Payments",
    description: "Uplifter Checkout (company-scoped)",
    envKeyApiKey: "ADYEN_API_KEY",
    envKeyClientKey: "NEXT_PUBLIC_ADYEN_CLIENT_KEY",
    roles: [
      "Checkout webservice role",
      "Merchant Recurring role",
      "Management API - Webhooks read and write",
      "Management API - API credentials read and write",
      "Management API - Accounts read and write",
      "Management API - Stores read and write",
    ],
  },
  {
    label: "Platform (Balance Platform)",
    description: "Uplifter Platform (balance-platform-scoped)",
    envKeyApiKey: "ADYEN_PLATFORM_API_KEY",
    roles: [
      "Balance Platform BCL role",
      "Balance Platform Manage Account Holders",
      "Balance Platform Manage Balance Accounts",
      "Balance Platform Manage Transfer Instruments",
    ],
  },
  {
    label: "Legal Entity Management",
    description: "Uplifter LEM (company-scoped)",
    envKeyApiKey: "ADYEN_LEM_API_KEY",
    roles: ["Legal Entity Management API - All"],
  },
];

// ---------------------------------------------------------------------------
// Webhook definitions
// ---------------------------------------------------------------------------

interface WebhookSpec {
  label: string;
  url: string;
  envKey: string;
  description: string;
}

function getWebhookConfigs(adminUrl: string): WebhookSpec[] {
  return [
    {
      label: "Standard Payment Webhook",
      url: `${adminUrl}/api/webhooks/adyen`,
      envKey: "ADYEN_WEBHOOK_HMAC_KEY",
      description: "Standard payment events (auth, capture, refund, chargeback)",
    },
    {
      label: "Balance Platform - Configuration",
      url: `${adminUrl}/api/webhooks/adyen-balance-platform`,
      envKey: "ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY",
      description: "Configuration webhook (account holder events)",
    },
    {
      label: "Balance Platform - Transfers",
      url: `${adminUrl}/api/webhooks/adyen-balance-platform`,
      envKey: "ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY",
      description: "Transfer webhook (payout/transfer events)",
    },
    {
      label: "Balance Platform - Negative Balance",
      url: `${adminUrl}/api/webhooks/adyen-balance-platform`,
      envKey: "ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY",
      description: "Negative Balance Compensation Warning webhook",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const DRY_RUN = !!args.dryRun;
  const targetEnv = args.env as Environment | undefined;

  if (!targetEnv || !ADMIN_URLS[targetEnv]) {
    console.error(
      "ERROR: --env is required. Must be one of: production, staging, development, local"
    );
    process.exit(1);
  }

  const ADYEN_API_KEY = process.env.ADYEN_API_KEY;
  if (!ADYEN_API_KEY) {
    console.error("ERROR: ADYEN_API_KEY is not set in your local .env file.");
    console.error(
      "       This key must have the 'Management API - API credentials read and write' role."
    );
    process.exit(1);
  }

  const adminUrl = ADMIN_URLS[targetEnv];

  console.log("===========================================");
  console.log("  Adyen Provisioning");
  console.log(`  Environment: ${targetEnv}`);
  console.log(`  Admin URL:   ${adminUrl}`);
  if (DRY_RUN) console.log("  MODE: DRY RUN (no changes will be made)");
  console.log("===========================================\n");

  const { Client, ManagementAPI } = require("@adyen/api-library");
  const adyenEnv = targetEnv === "production" ? "LIVE" : "TEST";
  const client = new Client({ apiKey: ADYEN_API_KEY, environment: adyenEnv });
  const mgmt = new ManagementAPI(client);

  // Step 1: Discover Company ID
  console.log("[Step 1/4] Discovering Company ID...");
  const companiesResponse = await mgmt.AccountCompanyLevelApi.listCompanyAccounts();
  const companies = companiesResponse.data || [];
  if (companies.length === 0) {
    console.error("ERROR: No company accounts found for this API key.");
    process.exit(1);
  }
  const companyId = companies[0].id;
  console.log(`  Found company: ${companyId} (${companies[0].name || ""})\n`);

  const generatedKeys: Record<string, string> = {};

  // Step 2: Create/find API credentials
  console.log("[Step 2/4] Setting up API credentials...\n");

  const existingCreds = await mgmt.APICredentialsCompanyLevelApi.listApiCredentials(
    companyId,
    1,
    100
  );
  const existingCredsList: any[] = existingCreds.data || [];

  for (const spec of API_CREDENTIALS) {
    console.log(`  ${spec.label}`);

    const existing = existingCredsList.find((c: any) => c.description === spec.description);

    if (existing) {
      console.log(`    Found existing: ${existing.id}`);

      if (!DRY_RUN) {
        const keyResult = await mgmt.APICredentialsCompanyLevelApi.generateNewApiKey(
          companyId,
          existing.id
        );
        generatedKeys[spec.envKeyApiKey] = keyResult.apiKey;
        console.log(`    API key regenerated: ${keyResult.apiKey.substring(0, 12)}...`);
        if (spec.envKeyClientKey && existing.clientKey) {
          generatedKeys[spec.envKeyClientKey] = existing.clientKey;
          console.log(`    Client key: ${existing.clientKey.substring(0, 12)}...`);
        }
      } else {
        generatedKeys[spec.envKeyApiKey] = "DRY_RUN_PLACEHOLDER";
        if (spec.envKeyClientKey) generatedKeys[spec.envKeyClientKey] = "DRY_RUN_PLACEHOLDER";
        console.log(`    [dry-run] Would regenerate API key`);
      }
    } else {
      if (DRY_RUN) {
        console.log(`    [dry-run] Would create credential: ${spec.description}`);
        generatedKeys[spec.envKeyApiKey] = "DRY_RUN_PLACEHOLDER";
        if (spec.envKeyClientKey) generatedKeys[spec.envKeyClientKey] = "DRY_RUN_PLACEHOLDER";
      } else {
        try {
          const created = await mgmt.APICredentialsCompanyLevelApi.createApiCredential(companyId, {
            description: spec.description,
            roles: spec.roles,
            allowedOrigins: [],
          });
          console.log(`    Created: ${created.id}`);

          const keyResult = await mgmt.APICredentialsCompanyLevelApi.generateNewApiKey(
            companyId,
            created.id
          );
          generatedKeys[spec.envKeyApiKey] = keyResult.apiKey;
          console.log(`    API key: ${keyResult.apiKey.substring(0, 12)}...`);

          if (spec.envKeyClientKey && created.clientKey) {
            generatedKeys[spec.envKeyClientKey] = created.clientKey;
            console.log(`    Client key: ${created.clientKey.substring(0, 12)}...`);
          }
        } catch (error: any) {
          console.error(`    ERROR creating credential: ${error.message || error}`);
          console.error(
            `    You may need to create this credential manually in the Customer Area.`
          );
        }
      }
    }
    console.log();
  }

  // Step 3: Create webhooks and generate HMAC keys
  console.log("[Step 3/4] Creating webhooks and generating HMAC keys...\n");

  const webhookConfigs = getWebhookConfigs(adminUrl);

  const existingWebhooks = await mgmt.WebhooksCompanyLevelApi.listAllWebhooks(companyId, 1, 100);
  const existingWebhookList: any[] = existingWebhooks.data || [];

  for (const config of webhookConfigs) {
    console.log(`  ${config.label}`);
    console.log(`    URL: ${config.url}`);

    const matchingWebhooks = existingWebhookList.filter((wh: any) => wh.url === config.url);

    // For the standard payment webhook, reuse existing if found
    const isStandard = config.envKey === "ADYEN_WEBHOOK_HMAC_KEY";
    const reuseExisting = isStandard && matchingWebhooks.length > 0;

    if (reuseExisting) {
      const existing = matchingWebhooks[0];
      console.log(`    Reusing existing webhook: ${existing.id}`);
      if (!DRY_RUN) {
        const hmac = await mgmt.WebhooksCompanyLevelApi.generateHmacKey(companyId, existing.id);
        generatedKeys[config.envKey] = hmac.hmacKey;
        console.log(`    HMAC: ${hmac.hmacKey.substring(0, 12)}...`);
      } else {
        generatedKeys[config.envKey] = "DRY_RUN_PLACEHOLDER";
        console.log(`    [dry-run] Would regenerate HMAC key`);
      }
    } else {
      if (DRY_RUN) {
        console.log(`    [dry-run] Would create webhook`);
        generatedKeys[config.envKey] = "DRY_RUN_PLACEHOLDER";
      } else {
        const webhook = await mgmt.WebhooksCompanyLevelApi.setUpWebhook(companyId, {
          type: "standard",
          url: config.url,
          active: true,
          communicationFormat: "json",
          filterMerchantAccountType: "allAccounts",
          filterMerchantAccounts: [],
          description: config.description,
        });
        console.log(`    Created: ${webhook.id}`);

        const hmac = await mgmt.WebhooksCompanyLevelApi.generateHmacKey(companyId, webhook.id);
        generatedKeys[config.envKey] = hmac.hmacKey;
        console.log(`    HMAC: ${hmac.hmacKey.substring(0, 12)}...`);
      }
    }
    console.log();
  }

  // Add static env vars
  generatedKeys["ADYEN_ENVIRONMENT"] = targetEnv === "production" ? "LIVE" : "TEST";
  generatedKeys["NEXT_PUBLIC_ADYEN_ENVIRONMENT"] = targetEnv === "production" ? "live" : "test";

  // Step 4: Output
  console.log("[Step 4/4] Outputting configuration...\n");

  const envLines: string[] = [];
  const keyOrder = [
    "ADYEN_API_KEY",
    "ADYEN_ENVIRONMENT",
    "NEXT_PUBLIC_ADYEN_CLIENT_KEY",
    "NEXT_PUBLIC_ADYEN_ENVIRONMENT",
    "ADYEN_PLATFORM_API_KEY",
    "ADYEN_LEM_API_KEY",
    "ADYEN_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY",
    "ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY",
  ];

  // Wrap values in single quotes if they contain shell-sensitive characters,
  // and escape `$` as `\$` so dotenv-expand (used by @next/env) preserves
  // the literal dollar sign instead of treating it as a variable reference.
  const NEEDS_QUOTING = /[$\\;{}^()!&|<> ]/;
  function quoteForEnv(val: string): string {
    if (!NEEDS_QUOTING.test(val)) return val;
    return `'${val.replace(/\$/g, "\\$")}'`;
  }

  for (const key of keyOrder) {
    if (generatedKeys[key]) {
      envLines.push(`${key}=${quoteForEnv(generatedKeys[key])}`);
    }
  }
  // Any remaining keys not in the order list
  for (const [key, value] of Object.entries(generatedKeys)) {
    if (!keyOrder.includes(key)) {
      envLines.push(`${key}=${quoteForEnv(value)}`);
    }
  }

  const envFragment = envLines.join("\n");

  if (args.output && typeof args.output === "string") {
    if (!DRY_RUN) {
      fs.writeFileSync(args.output, envFragment + "\n");
      console.log(`  Written to ${args.output}`);
    } else {
      console.log(`  [dry-run] Would write to ${args.output}`);
    }
  }

  if (args.deploySsh && typeof args.deploySsh === "string") {
    const sshHost = args.deploySsh;
    const envFilePath = "~/.env.uplifter";

    if (DRY_RUN) {
      console.log(`  [dry-run] Would SSH to ${sshHost} and update ${envFilePath}`);
    } else {
      const sshCommands: string[] = [];
      for (const [key, value] of Object.entries(generatedKeys)) {
        const escapedValue = value.replace(/[&/\\]/g, "\\$&");
        sshCommands.push(
          `if grep -q "^#\\?${key}=" ${envFilePath} 2>/dev/null; then ` +
            `sed -i "s|^#\\?${key}=.*|${key}=${escapedValue}|" ${envFilePath}; ` +
            `else echo "${key}=${escapedValue}" >> ${envFilePath}; fi`
        );
      }
      try {
        console.log(`  Connecting to ${sshHost}...`);
        execSync(`ssh ${sshHost} '${sshCommands.join(" && ")}'`, { stdio: "inherit" });
        console.log("  Environment variables updated on remote host.\n");
      } catch {
        console.error(`  ERROR: Failed to update ${sshHost}. Set variables manually:`);
        console.error(envFragment);
      }
    }
  }

  // Always print the fragment to stdout
  console.log("\n--- Generated .env fragment ---");
  for (const line of envLines) {
    const [key, val] = line.split("=");
    const display = DRY_RUN ? "[dry-run]" : `${val.substring(0, 16)}...`;
    console.log(`  ${key}=${display}`);
  }

  console.log("\n===========================================");
  console.log("  Provisioning Complete!");
  console.log("===========================================");
  console.log(`  Environment: ${targetEnv}`);
  console.log(`  API credentials: ${API_CREDENTIALS.length}`);
  console.log(`  Webhooks: ${webhookConfigs.length}`);
  console.log();
  console.log("  Next steps:");
  console.log("    1. Add the generated values to your environment's .env or secrets manager");
  console.log("    2. Also set these manually (not auto-provisioned):");
  console.log("       ADYEN_BALANCE_PLATFORM=UplifterLLC");
  console.log("       ADYEN_PLATFORM_MERCHANT_ACCOUNT=<your merchant account>");
  console.log("       ADYEN_LIABLE_BALANCE_ACCOUNT_ID=<your liable balance account>");
  console.log("    3. Deploy to pick up the new environment variables");
  console.log("    4. Test webhooks from the Adyen Customer Area");
  console.log();
}

main().catch((error) => {
  console.error("Provisioning failed:", error);
  process.exit(1);
});
