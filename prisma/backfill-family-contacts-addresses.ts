/**
 * Backfill Script: Family Contacts & Billing Addresses
 * =====================================================
 *
 * Migrates existing Family contact info (primaryContact, email, phone)
 * into FamilyContact records, and existing Family address fields into
 * FamilyBillingAddress records, all marked as isPrimary: true.
 *
 * Safe to run multiple times -- skips families that already have records.
 *
 * Usage:
 *   npx tsx prisma/backfill-family-contacts-addresses.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of FamilyContact and FamilyBillingAddress...");

  // Fetch all families that don't yet have any contacts
  const familiesWithoutContacts = await prisma.family.findMany({
    where: {
      contacts: { none: {} },
    },
    select: {
      id: true,
      primaryContact: true,
      email: true,
      phone: true,
      address: true,
    },
  });

  console.log(
    `Found ${familiesWithoutContacts.length} families without contacts to backfill.`
  );

  let contactsCreated = 0;
  let addressesCreated = 0;

  for (const family of familiesWithoutContacts) {
    // Parse the primaryContact into first/last name
    const nameParts = (family.primaryContact || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Only create a contact if we have at least a name and email
    if (firstName && family.email) {
      await prisma.familyContact.create({
        data: {
          familyId: family.id,
          firstName,
          lastName,
          email: family.email,
          phone: family.phone || "",
          relationship: "Parent",
          isPrimary: true,
        },
      });
      contactsCreated++;
    }

    // Create billing address if the family has an address
    if (family.address && family.address.trim()) {
      await prisma.familyBillingAddress.create({
        data: {
          familyId: family.id,
          label: "Home",
          street: family.address.trim(),
          city: "",
          postalCode: "",
          country: "US",
          isPrimary: true,
        },
      });
      addressesCreated++;
    }
  }

  // Also backfill addresses for families that have contacts but no addresses yet
  const familiesWithoutAddresses = await prisma.family.findMany({
    where: {
      billingAddresses: { none: {} },
      address: { not: null },
    },
    select: {
      id: true,
      address: true,
    },
  });

  for (const family of familiesWithoutAddresses) {
    if (family.address && family.address.trim()) {
      await prisma.familyBillingAddress.create({
        data: {
          familyId: family.id,
          label: "Home",
          street: family.address.trim(),
          city: "",
          postalCode: "",
          country: "US",
          isPrimary: true,
        },
      });
      addressesCreated++;
    }
  }

  console.log(
    `Backfill complete. Created ${contactsCreated} contacts and ${addressesCreated} billing addresses.`
  );
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
