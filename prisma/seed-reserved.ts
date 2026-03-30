import { PrismaClient, ReservedDomainType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Comprehensive list of reserved domains for the Uplifter platform.
 * This includes all middleware-routed portals, infrastructure, and brand protection.
 */
const RESERVED_DOMAIN_DATA = [
  // System portals - middleware routes (CRITICAL: these are routed by middleware)
  { pattern: "login", type: ReservedDomainType.EXACT, reason: "System use - login portal" },
  { pattern: "admin", type: ReservedDomainType.EXACT, reason: "System use - admin portal" },
  {
    pattern: "superadmin",
    type: ReservedDomainType.EXACT,
    reason: "System use - superadmin portal",
  },
  { pattern: "coach", type: ReservedDomainType.EXACT, reason: "System use - coach portal" },
  { pattern: "athletes", type: ReservedDomainType.EXACT, reason: "System use - athletes portal" },
  { pattern: "pos", type: ReservedDomainType.EXACT, reason: "System use - POS portal" },
  { pattern: "feedback", type: ReservedDomainType.EXACT, reason: "System use - feedback portal" },
  { pattern: "events", type: ReservedDomainType.EXACT, reason: "System use - events portal" },
  { pattern: "startup", type: ReservedDomainType.EXACT, reason: "System use - org signup portal" },
  { pattern: "my", type: ReservedDomainType.EXACT, reason: "Reserved - future subsite" },
  {
    pattern: "competition",
    type: ReservedDomainType.EXACT,
    reason: "Reserved - prevents confusion with competitions portal",
  },
  {
    pattern: "competitions",
    type: ReservedDomainType.EXACT,
    reason: "System use - competitions portal",
  },
  {
    pattern: "result",
    type: ReservedDomainType.EXACT,
    reason: "Reserved - prevents confusion with results portal",
  },
  { pattern: "results", type: ReservedDomainType.EXACT, reason: "System use - results portal" },

  // Infrastructure
  { pattern: "api", type: ReservedDomainType.EXACT, reason: "System use - API endpoint" },
  { pattern: "app", type: ReservedDomainType.EXACT, reason: "System use - application" },
  { pattern: "www", type: ReservedDomainType.EXACT, reason: "System use - main website" },
  { pattern: "mail", type: ReservedDomainType.EXACT, reason: "System use - email services" },
  {
    pattern: "chat",
    type: ReservedDomainType.EXACT,
    reason: "System use - inbound email for chat replies",
  },
  { pattern: "cdn", type: ReservedDomainType.EXACT, reason: "System use - content delivery" },
  { pattern: "static", type: ReservedDomainType.EXACT, reason: "System use - static assets" },
  { pattern: "assets", type: ReservedDomainType.EXACT, reason: "System use - asset hosting" },
  { pattern: "images", type: ReservedDomainType.EXACT, reason: "System use - image hosting" },
  { pattern: "files", type: ReservedDomainType.EXACT, reason: "System use - file hosting" },
  { pattern: "download", type: ReservedDomainType.EXACT, reason: "System use - downloads" },
  { pattern: "upload", type: ReservedDomainType.EXACT, reason: "System use - uploads" },
  { pattern: "dashboard", type: ReservedDomainType.EXACT, reason: "System use - dashboard routes" },

  // Support & Documentation
  { pattern: "help", type: ReservedDomainType.EXACT, reason: "System use - help center" },
  { pattern: "support", type: ReservedDomainType.EXACT, reason: "System use - support portal" },
  { pattern: "status", type: ReservedDomainType.EXACT, reason: "System use - status page" },
  { pattern: "docs", type: ReservedDomainType.EXACT, reason: "System use - documentation" },
  { pattern: "blog", type: ReservedDomainType.EXACT, reason: "System use - blog" },

  // Account management
  { pattern: "signup", type: ReservedDomainType.EXACT, reason: "System use - signup pages" },
  { pattern: "register", type: ReservedDomainType.EXACT, reason: "System use - registration" },
  { pattern: "account", type: ReservedDomainType.EXACT, reason: "System use - account management" },
  { pattern: "settings", type: ReservedDomainType.EXACT, reason: "System use - settings pages" },
  { pattern: "billing", type: ReservedDomainType.EXACT, reason: "System use - billing portal" },
  { pattern: "payment", type: ReservedDomainType.EXACT, reason: "System use - payment pages" },
  { pattern: "checkout", type: ReservedDomainType.EXACT, reason: "System use - checkout" },

  // Brand protection
  {
    pattern: "uplifter",
    type: ReservedDomainType.EXACT,
    reason: "Brand protection - Uplifter trademark",
  },
  {
    pattern: "leapfrog",
    type: ReservedDomainType.EXACT,
    reason: "Brand protection - LeapFrog trademark",
  },

  // Reserved words - exact matches
  { pattern: "test", type: ReservedDomainType.EXACT, reason: "System use - reserved word" },
  { pattern: "demo", type: ReservedDomainType.EXACT, reason: "System use - reserved word" },

  // Prefix reserved - blocks anything starting with pattern
  {
    pattern: "test-",
    type: ReservedDomainType.PREFIX,
    reason: "System use - testing environments",
  },
  { pattern: "demo-", type: ReservedDomainType.PREFIX, reason: "System use - demo environments" },
  {
    pattern: "staging-",
    type: ReservedDomainType.PREFIX,
    reason: "System use - staging environments",
  },
  {
    pattern: "dev-",
    type: ReservedDomainType.PREFIX,
    reason: "System use - development environments",
  },
];

async function main() {
  console.log("Seeding reserved domains...");

  for (const rd of RESERVED_DOMAIN_DATA) {
    await prisma.reservedDomain.upsert({
      where: { pattern: rd.pattern },
      update: { reason: rd.reason, type: rd.type },
      create: rd,
    });
  }

  console.log(
    `Seeding completed. Created/updated ${RESERVED_DOMAIN_DATA.length} reserved domains.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
