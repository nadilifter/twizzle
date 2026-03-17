/**
 * Adyen Staging Provisioning Script
 *
 * Automates the creation of Adyen webhook subscriptions and HMAC keys
 * for the staging environment, then patches the EC2 .env.uplifter file
 * via SSH.
 *
 * Prerequisites:
 *   - ADYEN_API_KEY must be set in your local .env (company-scoped key)
 *   - SSH config entry "uplifter-staging" must exist (~/.ssh/config)
 *
 * Usage:
 *   npx tsx scripts/provision-adyen-staging.ts
 *   npx tsx scripts/provision-adyen-staging.ts --dry-run   # preview only
 */

import { execSync } from "child_process"

// Load env vars using Next.js loader (handles dotenv-expand correctly)
const { loadEnvConfig } = require("@next/env")
loadEnvConfig(process.cwd())

const ADYEN_API_KEY = process.env.ADYEN_API_KEY
if (!ADYEN_API_KEY) {
  console.error("ERROR: ADYEN_API_KEY is not set in your local .env file.")
  process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")
const SSH_HOST = "uplifter-staging"
const ENV_FILE_PATH = "~/.env.uplifter"
const STAGING_ADMIN_URL = "https://admin.upliftergymnastics.com"

const WEBHOOK_CONFIGS = [
  {
    label: "Standard Payment Webhook",
    type: "standard",
    url: `${STAGING_ADMIN_URL}/api/webhooks/adyen`,
    envKey: "ADYEN_WEBHOOK_HMAC_KEY",
  },
  {
    label: "Balance Platform - Configuration",
    type: "standard",
    url: `${STAGING_ADMIN_URL}/api/webhooks/adyen-balance-platform`,
    envKey: "ADYEN_BP_CONFIG_WEBHOOK_HMAC_KEY",
    description: "Configuration webhook (account holder events)",
  },
  {
    label: "Balance Platform - Transfers",
    type: "standard",
    url: `${STAGING_ADMIN_URL}/api/webhooks/adyen-balance-platform`,
    envKey: "ADYEN_BP_TRANSFER_WEBHOOK_HMAC_KEY",
    description: "Transfer webhook (transfer events)",
  },
  {
    label: "Balance Platform - Negative Balance",
    type: "standard",
    url: `${STAGING_ADMIN_URL}/api/webhooks/adyen-balance-platform`,
    envKey: "ADYEN_BP_NEGBAL_WEBHOOK_HMAC_KEY",
    description: "Negative Balance Compensation Warning webhook",
  },
]

async function main() {
  console.log("===========================================")
  console.log("  Adyen Staging Provisioning")
  console.log("  Target: upliftergymnastics.com")
  if (DRY_RUN) console.log("  MODE: DRY RUN (no changes will be made)")
  console.log("===========================================\n")

  // Initialize Adyen Management API client
  const { Client, ManagementAPI } = require("@adyen/api-library")
  const client = new Client({
    apiKey: ADYEN_API_KEY,
    environment: "TEST",
  })
  const mgmt = new ManagementAPI(client)

  // Step A: Discover Company ID
  console.log("[Step 1/4] Discovering Company ID...")
  const companiesResponse = await mgmt.AccountCompanyLevelApi.listCompanyAccounts()
  const companies = companiesResponse.data || []
  if (companies.length === 0) {
    console.error("ERROR: No company accounts found for this API key.")
    process.exit(1)
  }
  const companyId = companies[0].id
  console.log(`  Found company: ${companyId} (${companies[0].name || ""})\n`)

  // Step B: List existing webhooks to avoid duplicates
  console.log("[Step 2/4] Checking existing webhooks...")
  const existingWebhooks = await mgmt.WebhooksCompanyLevelApi.listAllWebhooks(companyId, 1, 100)
  const existingUrls = new Map<string, { id: string; url: string; type: string }[]>()
  for (const wh of existingWebhooks.data || []) {
    const key = wh.url || ""
    if (!existingUrls.has(key)) existingUrls.set(key, [])
    existingUrls.get(key)!.push({ id: wh.id, url: wh.url, type: wh.type })
  }

  // Step C: Create webhooks and generate HMAC keys
  console.log("[Step 3/4] Creating webhooks and generating HMAC keys...\n")
  const generatedKeys: Record<string, string> = {}
  const createdWebhookIds: string[] = []

  for (const config of WEBHOOK_CONFIGS) {
    console.log(`  ${config.label}`)
    console.log(`    URL: ${config.url}`)

    // Check if a webhook with this URL already exists
    const existingForUrl = existingUrls.get(config.url) || []
    if (existingForUrl.length > 0) {
      // For balance platform webhooks, multiple can share the same URL
      // but we only skip if we already have enough
      const isBalancePlatform = config.envKey.startsWith("ADYEN_BP_")
      const bpCount = WEBHOOK_CONFIGS.filter(c => c.url === config.url && c.envKey.startsWith("ADYEN_BP_")).length
      
      if (!isBalancePlatform && existingForUrl.length >= 1) {
        console.log(`    SKIP: Webhook already exists (id: ${existingForUrl[0].id})`)
        // Still generate a new HMAC key for it
        if (!DRY_RUN) {
          const hmac = await mgmt.WebhooksCompanyLevelApi.generateHmacKey(companyId, existingForUrl[0].id)
          generatedKeys[config.envKey] = hmac.hmacKey
          console.log(`    HMAC: ${hmac.hmacKey.substring(0, 12)}...`)
        } else {
          generatedKeys[config.envKey] = "DRY_RUN_PLACEHOLDER"
          console.log(`    HMAC: [dry-run]`)
        }
        console.log()
        continue
      }
    }

    if (DRY_RUN) {
      console.log(`    CREATE: [dry-run]`)
      generatedKeys[config.envKey] = "DRY_RUN_PLACEHOLDER"
      console.log(`    HMAC: [dry-run]`)
      console.log()
      continue
    }

    // Create the webhook
    const webhook = await mgmt.WebhooksCompanyLevelApi.setUpWebhook(companyId, {
      type: config.type,
      url: config.url,
      active: true,
      communicationFormat: "json",
      filterMerchantAccountType: "allAccounts",
      filterMerchantAccounts: [],
      description: config.description || config.label,
    })

    console.log(`    Created: ${webhook.id}`)
    createdWebhookIds.push(webhook.id)

    // Generate HMAC key
    const hmac = await mgmt.WebhooksCompanyLevelApi.generateHmacKey(companyId, webhook.id)
    generatedKeys[config.envKey] = hmac.hmacKey
    console.log(`    HMAC: ${hmac.hmacKey.substring(0, 12)}...`)
    console.log()
  }

  // Step D: Patch the EC2 .env.uplifter file via SSH
  console.log("[Step 4/4] Updating staging environment variables...\n")

  const envLines: string[] = []
  for (const [key, value] of Object.entries(generatedKeys)) {
    envLines.push(`${key}=${value}`)
  }

  if (DRY_RUN) {
    console.log("  DRY RUN: Would write the following to staging .env.uplifter:")
    for (const line of envLines) {
      const [key, val] = line.split("=")
      console.log(`    ${key}=${val.substring(0, 12)}...`)
    }
    console.log("\n  No changes made (dry run).")
    return
  }

  // Build a sed command that replaces existing keys or appends new ones
  const sshCommands: string[] = []
  for (const [key, value] of Object.entries(generatedKeys)) {
    // Escape special characters in the value for sed
    const escapedValue = value.replace(/[&/\\]/g, "\\$&")
    // If the key exists (commented or not), replace it; otherwise append
    sshCommands.push(
      `if grep -q "^#\\?${key}=" ${ENV_FILE_PATH} 2>/dev/null; then ` +
      `sed -i "s|^#\\?${key}=.*|${key}=${escapedValue}|" ${ENV_FILE_PATH}; ` +
      `else echo "${key}=${escapedValue}" >> ${ENV_FILE_PATH}; fi`
    )
  }

  const fullSshCommand = sshCommands.join(" && ")

  try {
    console.log(`  Connecting to ${SSH_HOST}...`)
    execSync(`ssh ${SSH_HOST} '${fullSshCommand}'`, { stdio: "inherit" })
    console.log("  Environment variables updated successfully!\n")
  } catch (error) {
    console.error("  ERROR: Failed to update staging environment variables.")
    console.error("  You can manually set the following in ~/.env.uplifter on the EC2 instance:\n")
    for (const line of envLines) {
      console.log(`    ${line}`)
    }
    console.error()
    process.exit(1)
  }

  // Summary
  console.log("===========================================")
  console.log("  Provisioning Complete!")
  console.log("===========================================")
  console.log()
  console.log(`  Company ID: ${companyId}`)
  console.log(`  Webhooks created: ${createdWebhookIds.length}`)
  console.log(`  HMAC keys generated: ${Object.keys(generatedKeys).length}`)
  console.log()
  console.log("  Next steps:")
  console.log("    1. Redeploy staging to pick up new env vars:")
  console.log("       ./scripts/deploy-staging.sh")
  console.log("    2. Test webhooks from the Adyen Customer Area:")
  console.log("       https://ca-test.adyen.com")
  console.log()
}

main().catch((error) => {
  console.error("Provisioning failed:", error)
  process.exit(1)
})
