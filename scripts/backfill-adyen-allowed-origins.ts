/**
 * Backfill Adyen Allowed Origins
 *
 * Registers allowed origins for all active organizations that have a subdomain.
 * Also registers the fixed subdomains (startup, admin, athletes) for the
 * current environment.
 *
 * Prerequisites:
 *   - ADYEN_API_KEY must be set in your .env (company-scoped key)
 *   - DATABASE_URL must be set in your .env
 *
 * Usage:
 *   npx tsx scripts/backfill-adyen-allowed-origins.ts            # run for real
 *   npx tsx scripts/backfill-adyen-allowed-origins.ts --dry-run   # preview only
 */

const { loadEnvConfig } = require("@next/env")
loadEnvConfig(process.cwd())

const ADYEN_API_KEY = process.env.ADYEN_API_KEY
if (!ADYEN_API_KEY) {
  console.error("ERROR: ADYEN_API_KEY is not set in your .env file.")
  process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")
const FIXED_SUBDOMAINS = ["startup", "admin", "athletes"]

async function main() {
  console.log("===========================================")
  console.log("  Adyen Allowed Origins Backfill")
  if (DRY_RUN) console.log("  MODE: DRY RUN (no changes will be made)")
  console.log("===========================================\n")

  const { PrismaClient } = require("@prisma/client")
  const { Client, ManagementAPI } = require("@adyen/api-library")
  const { getSubdomainUrl } = require("../src/lib/env-domains")

  const prisma = new PrismaClient()
  const client = new Client({
    apiKey: ADYEN_API_KEY,
    environment: process.env.ADYEN_ENVIRONMENT?.toUpperCase() === "LIVE" ? "LIVE" : "TEST",
  })
  const mgmt = new ManagementAPI(client)

  try {
    // Fetch current allowed origins from Adyen
    console.log("[Step 1/3] Fetching current allowed origins from Adyen...")
    const existingResponse = await mgmt.MyAPICredentialApi.getAllowedOrigins()
    const existingOrigins: any[] = existingResponse.data ?? existingResponse ?? []
    const existingDomains = new Set(existingOrigins.map((o: any) => o.domain))
    console.log(`  Found ${existingDomains.size} existing origin(s)\n`)

    // Gather all subdomains that need origins
    console.log("[Step 2/3] Querying active org subdomains from database...")
    const configs = await prisma.websiteConfig.findMany({
      where: { organization: { isActive: true } },
      select: { subdomain: true },
    })
    const orgSubdomains: string[] = configs
      .map((c: any) => c.subdomain)
      .filter(Boolean)
    console.log(`  Found ${orgSubdomains.length} active org subdomain(s)`)

    const allSubdomains = [...FIXED_SUBDOMAINS, ...orgSubdomains]
    console.log(`  Total to check: ${allSubdomains.length} (${FIXED_SUBDOMAINS.length} fixed + ${orgSubdomains.length} orgs)\n`)

    // Register missing origins
    console.log("[Step 3/3] Registering missing origins...\n")
    let added = 0
    let skipped = 0

    for (const subdomain of allSubdomains) {
      const origin = getSubdomainUrl(subdomain)

      if (existingDomains.has(origin)) {
        console.log(`  SKIP: ${origin} (already registered)`)
        skipped++
        continue
      }

      if (DRY_RUN) {
        console.log(`  WOULD ADD: ${origin}`)
        added++
        continue
      }

      try {
        await mgmt.MyAPICredentialApi.addAllowedOrigin({ domain: origin })
        console.log(`  ADDED: ${origin}`)
        existingDomains.add(origin)
        added++
      } catch (err: any) {
        console.error(`  ERROR: Failed to add ${origin}: ${err.message || err}`)
      }
    }

    // Summary
    console.log("\n===========================================")
    console.log("  Backfill Complete!")
    console.log("===========================================")
    console.log(`  Added: ${added}`)
    console.log(`  Skipped (already existed): ${skipped}`)
    if (DRY_RUN) console.log("  (dry run — no changes were made)")
    console.log()
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error("Backfill failed:", error)
  process.exit(1)
})
