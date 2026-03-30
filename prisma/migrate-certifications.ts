/**
 * Data Migration: JSON Certifications → Normalized Tables
 * =======================================================
 *
 * Migrates the legacy `certifications` JSON field on OrganizationMember
 * to the new Certification + MemberCertification tables.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/migrate-certifications.ts
 *
 * What it does:
 * 1. Reads all OrganizationMember records that have a non-null certifications JSON
 * 2. Extracts unique certification names per organization
 * 3. Creates a Certification record for each unique name (PASS_FAIL, no scopes)
 * 4. Creates MemberCertification records linking members to the new certs
 * 5. Reports results (does NOT delete the JSON field — do that in a later migration)
 */

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface LegacyCert {
  name: string;
  expiresAt?: string | null;
  verified?: boolean;
}

async function main() {
  console.log("🔄 Starting certification data migration...\n");

  const membersWithCerts = await prisma.organizationMember.findMany({
    where: {
      NOT: { certifications: { equals: Prisma.DbNull } },
    },
    select: {
      id: true,
      organizationId: true,
      certifications: true,
    },
  });

  console.log(`Found ${membersWithCerts.length} members with JSON certifications`);

  if (membersWithCerts.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  // Group unique cert names by organization
  const orgCertNames = new Map<string, Set<string>>();
  for (const member of membersWithCerts) {
    const certs = member.certifications as LegacyCert[] | null;
    if (!certs || !Array.isArray(certs)) continue;

    if (!orgCertNames.has(member.organizationId)) {
      orgCertNames.set(member.organizationId, new Set());
    }
    for (const c of certs) {
      orgCertNames.get(member.organizationId)!.add(c.name);
    }
  }

  // Create Certification records
  const certIdMap = new Map<string, string>(); // "orgId:certName" -> certId
  let certsCreated = 0;

  for (const [orgId, names] of orgCertNames) {
    for (const name of names) {
      const existing = await prisma.certification.findFirst({
        where: { organizationId: orgId, name },
      });

      if (existing) {
        certIdMap.set(`${orgId}:${name}`, existing.id);
        console.log(`  ⏭ Certification "${name}" already exists for org ${orgId}`);
        continue;
      }

      const cert = await prisma.certification.create({
        data: {
          organizationId: orgId,
          name,
          evaluationMethod: "PASS_FAIL",
          isActive: true,
        },
      });
      certIdMap.set(`${orgId}:${name}`, cert.id);
      certsCreated++;
      console.log(`  ✓ Created certification "${name}" for org ${orgId}`);
    }
  }

  console.log(`\nCreated ${certsCreated} certification definitions`);

  // Create MemberCertification records
  let memberCertsCreated = 0;
  let memberCertsSkipped = 0;

  for (const member of membersWithCerts) {
    const certs = member.certifications as LegacyCert[] | null;
    if (!certs || !Array.isArray(certs)) continue;

    for (const c of certs) {
      const certId = certIdMap.get(`${member.organizationId}:${c.name}`);
      if (!certId) {
        console.warn(
          `  ⚠ No certification ID found for "${c.name}" in org ${member.organizationId}`
        );
        continue;
      }

      const existing = await prisma.memberCertification.findUnique({
        where: {
          certificationId_memberId: {
            certificationId: certId,
            memberId: member.id,
          },
        },
      });

      if (existing) {
        memberCertsSkipped++;
        continue;
      }

      await prisma.memberCertification.create({
        data: {
          certificationId: certId,
          memberId: member.id,
          passed: c.verified ?? true,
          grantedAt: new Date(),
          expiresAt: c.expiresAt ? new Date(c.expiresAt) : null,
        },
      });
      memberCertsCreated++;
    }
  }

  console.log(
    `\nCreated ${memberCertsCreated} member certifications (${memberCertsSkipped} skipped as duplicates)`
  );
  console.log("\n✅ Migration complete!");
  console.log("Note: The JSON 'certifications' field on OrganizationMember has NOT been removed.");
  console.log("After verifying the migration, remove it in a future schema change.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
