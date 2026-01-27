import { PrismaClient, ReservedDomainType } from "@prisma/client"

const prisma = new PrismaClient()

const RESERVED_DOMAINS = [
  "admin",
  "superadmin",
  "coach",
  "athletes",
  "pos",
  "feedback",
  "www",
  "api",
  "mail",
  "smtp",
  "pop",
  "imap",
  "ftp",
  "cpanel",
  "webmail",
]

async function main() {
  console.log("Seeding reserved domains...")

  for (const domain of RESERVED_DOMAINS) {
    await prisma.reservedDomain.upsert({
      where: { pattern: domain },
      update: {},
      create: {
        pattern: domain,
        type: ReservedDomainType.EXACT,
        reason: "System Reserved Subdomain",
      },
    })
  }

  console.log("Seeding completed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
