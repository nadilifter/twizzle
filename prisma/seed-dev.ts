/**
 * Development Seed Script
 * =======================
 * 
 * This script populates the database with comprehensive dummy data for development
 * and testing purposes. It creates two distinct organizations with different data
 * to test multi-tenancy and various features.
 * 
 * Organizations:
 * 1. Sunrise Gymnastics Academy - Youth gymnastics club
 * 2. Metro Sports Complex - Multi-sport community facility
 * 
 * Usage:
 *   pnpm db:seed:dev
 * 
 * To reset and reseed:
 *   pnpm prisma migrate reset && pnpm db:seed:dev
 * 
 * Last Updated: 2026-01-27
 * 
 * MAINTENANCE NOTES:
 * - When adding new models to schema.prisma, add seed data in the corresponding section
 * - Use deterministic IDs (prefixed with org slug) for idempotent seeding
 * - Use upsert pattern to allow re-running without errors
 * - Keep realistic data that exercises edge cases
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Redis } from "@upstash/redis";

const prisma = new PrismaClient();

// Initialize Redis client for analytics seeding (if configured)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// ============================================
// CONSTANTS & HELPERS
// ============================================

const ORG1_ID = "seed-org-sunrise";
const ORG2_ID = "seed-org-metro";
// Plan IDs will be dynamically assigned from the upsert results

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const SEED_PASSWORD = "password123";

async function main() {
  console.log("🌱 Starting development seed...\n");
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 12);

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================
  console.log("📋 Creating subscription plans...");
  
  // Use slug for where clause to be idempotent regardless of IDs
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "free" },
    update: {},
    create: {
      name: "Free", slug: "free", description: "Perfect for getting started",
      monthlyPrice: 0, yearlyPrice: 0, transactionFee: 0.05, perTransactionFee: 0.50,
      maxAthletes: 25, maxUsers: 2, maxEvents: 10,
      features: ["Basic scheduling", "Up to 25 athletes", "Email support"],
      isPopular: false, displayOrder: 0, isActive: true, isPublic: true,
    },
  });
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter", slug: "starter", description: "For growing organizations",
      monthlyPrice: 49, yearlyPrice: 470, transactionFee: 0.035, perTransactionFee: 0.35,
      maxAthletes: 100, maxUsers: 5, maxEvents: 50,
      features: ["Advanced scheduling", "Up to 100 athletes", "Priority email support", "Basic reporting"],
      isPopular: false, displayOrder: 1, isActive: true, isPublic: true,
    },
  });
  const goldPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "gold" },
    update: {},
    create: {
      name: "Gold", slug: "gold", description: "Most popular for established clubs",
      monthlyPrice: 149, yearlyPrice: 1430, transactionFee: 0.029, perTransactionFee: 0.30,
      maxAthletes: 500, maxUsers: 15, maxEvents: null,
      features: ["Unlimited events", "Up to 500 athletes", "Phone support", "Advanced reporting", "Custom branding"],
      isPopular: true, displayOrder: 2, isActive: true, isPublic: true,
    },
  });
  const platinumPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "platinum" },
    update: {},
    create: {
      name: "Platinum", slug: "platinum", description: "Enterprise-grade solution",
      monthlyPrice: 349, yearlyPrice: 3350, transactionFee: 0.025, perTransactionFee: 0.25,
      maxAthletes: null, maxUsers: null, maxEvents: null,
      features: ["Unlimited everything", "Dedicated support", "Custom integrations", "White-label options", "SLA guarantee"],
      isPopular: false, displayOrder: 3, isActive: true, isPublic: true,
    },
  });
  console.log("  ✓ Created 4 subscription plans");

  // ============================================
  // ORGANIZATIONS
  // ============================================
  console.log("\n🏢 Creating organizations...");
  const org1 = await prisma.organization.upsert({
    where: { id: ORG1_ID }, update: {},
    create: { id: ORG1_ID, name: "Sunrise Gymnastics Academy", slug: "sunrise-gymnastics" },
  });
  const org2 = await prisma.organization.upsert({
    where: { id: ORG2_ID }, update: {},
    create: { id: ORG2_ID, name: "Metro Sports Complex", slug: "metro-sports" },
  });
  console.log(`  ✓ Created: ${org1.name}`);
  console.log(`  ✓ Created: ${org2.name}`);

  // ============================================
  // ORGANIZATION SUBSCRIPTIONS
  // ============================================
  console.log("\n💳 Creating organization subscriptions...");
  await Promise.all([
    prisma.organizationSubscription.upsert({
      where: { organizationId: ORG1_ID }, update: {},
      create: {
        organizationId: ORG1_ID, planId: goldPlan.id, status: "ACTIVE", billingCycle: "YEARLY",
        currentPeriodStart: daysAgo(30), currentPeriodEnd: daysFromNow(335),
        stripeCustomerId: "cus_seed_sunrise", stripeSubscriptionId: "sub_seed_sunrise",
      },
    }),
    prisma.organizationSubscription.upsert({
      where: { organizationId: ORG2_ID }, update: {},
      create: {
        organizationId: ORG2_ID, planId: starterPlan.id, status: "ACTIVE", billingCycle: "MONTHLY",
        currentPeriodStart: daysAgo(15), currentPeriodEnd: daysFromNow(15),
        stripeCustomerId: "cus_seed_metro", stripeSubscriptionId: "sub_seed_metro",
      },
    }),
  ]);
  console.log("  ✓ Created subscriptions for both organizations");

  // ============================================
  // USERS
  // ============================================
  console.log("\n👤 Creating users...");
  const org1Admin = await prisma.user.upsert({
    where: { email: "admin@sunrise-gymnastics.com" },
    update: { organizationId: ORG1_ID },
    create: { email: "admin@sunrise-gymnastics.com", name: "Jennifer Walsh", passwordHash: hashedPassword, role: "ADMIN", status: "ACTIVE", organizationId: ORG1_ID },
  });
  const org1Coach1 = await prisma.user.upsert({
    where: { email: "coach.maria@sunrise-gymnastics.com" },
    update: { organizationId: ORG1_ID },
    create: { email: "coach.maria@sunrise-gymnastics.com", name: "Maria Rodriguez", passwordHash: hashedPassword, role: "COACH", status: "ACTIVE", organizationId: ORG1_ID },
  });
  const org1Coach2 = await prisma.user.upsert({
    where: { email: "coach.james@sunrise-gymnastics.com" },
    update: { organizationId: ORG1_ID },
    create: { email: "coach.james@sunrise-gymnastics.com", name: "James Chen", passwordHash: hashedPassword, role: "COACH", status: "ACTIVE", organizationId: ORG1_ID },
  });
  const org1Accountant = await prisma.user.upsert({
    where: { email: "finance@sunrise-gymnastics.com" },
    update: { organizationId: ORG1_ID },
    create: { email: "finance@sunrise-gymnastics.com", name: "Robert Kim", passwordHash: hashedPassword, role: "ACCOUNTANT", status: "ACTIVE", organizationId: ORG1_ID },
  });
  const org2Admin = await prisma.user.upsert({
    where: { email: "admin@metro-sports.com" },
    update: { organizationId: ORG2_ID },
    create: { email: "admin@metro-sports.com", name: "Michael Thompson", passwordHash: hashedPassword, role: "ADMIN", status: "ACTIVE", organizationId: ORG2_ID },
  });
  const org2Coach = await prisma.user.upsert({
    where: { email: "coach.sarah@metro-sports.com" },
    update: { organizationId: ORG2_ID },
    create: { email: "coach.sarah@metro-sports.com", name: "Sarah Martinez", passwordHash: hashedPassword, role: "COACH", status: "ACTIVE", organizationId: ORG2_ID },
  });
  const org2Volunteer = await prisma.user.upsert({
    where: { email: "volunteer@metro-sports.com" },
    update: { organizationId: ORG2_ID },
    create: { email: "volunteer@metro-sports.com", name: "David Lee", passwordHash: hashedPassword, role: "VOLUNTEER", status: "ACTIVE", organizationId: ORG2_ID },
  });
  console.log("  ✓ Created 7 users across both organizations");

  // ============================================
  // ORGANIZATION MEMBERS
  // ============================================
  console.log("\n👥 Creating organization memberships...");
  const membershipData = [
    { orgId: ORG1_ID, userId: org1Admin.id, role: "ADMIN" as const },
    { orgId: ORG1_ID, userId: org1Coach1.id, role: "COACH" as const },
    { orgId: ORG1_ID, userId: org1Coach2.id, role: "COACH" as const },
    { orgId: ORG1_ID, userId: org1Accountant.id, role: "ACCOUNTANT" as const },
    { orgId: ORG2_ID, userId: org2Admin.id, role: "ADMIN" as const },
    { orgId: ORG2_ID, userId: org2Coach.id, role: "COACH" as const },
    { orgId: ORG2_ID, userId: org2Volunteer.id, role: "VOLUNTEER" as const },
  ];
  await Promise.all(membershipData.map((m) =>
    prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: m.orgId, userId: m.userId } },
      update: { role: m.role, status: "ACTIVE" },
      create: { organizationId: m.orgId, userId: m.userId, role: m.role, status: "ACTIVE" },
    })
  ));
  console.log(`  ✓ Created ${membershipData.length} organization memberships`);

  // ============================================
  // USER PERMISSIONS
  // ============================================
  console.log("\n🔐 Creating user permissions...");
  const permissionData = [
    { userId: org1Admin.id, permission: "*" },
    { userId: org2Admin.id, permission: "*" },
    { userId: org1Coach1.id, permission: "dashboard.view" },
    { userId: org1Coach1.id, permission: "athletes.view" },
    { userId: org1Coach1.id, permission: "athletes.edit" },
    { userId: org1Coach1.id, permission: "training.view" },
    { userId: org1Coach1.id, permission: "training.create" },
    { userId: org1Coach1.id, permission: "events.view" },
    { userId: org1Coach2.id, permission: "dashboard.view" },
    { userId: org1Coach2.id, permission: "athletes.view" },
    { userId: org1Coach2.id, permission: "training.view" },
    { userId: org2Coach.id, permission: "dashboard.view" },
    { userId: org2Coach.id, permission: "athletes.view" },
    { userId: org2Coach.id, permission: "events.view" },
    { userId: org1Accountant.id, permission: "dashboard.view" },
    { userId: org1Accountant.id, permission: "financials.view" },
    { userId: org1Accountant.id, permission: "financials.edit" },
    { userId: org1Accountant.id, permission: "invoices.view" },
    { userId: org1Accountant.id, permission: "invoices.create" },
    { userId: org2Volunteer.id, permission: "dashboard.view" },
    { userId: org2Volunteer.id, permission: "events.view" },
  ];
  for (const p of permissionData) {
    await prisma.userPermission.upsert({
      where: { userId_permission: { userId: p.userId, permission: p.permission } },
      update: {},
      create: { userId: p.userId, permission: p.permission },
    });
  }
  console.log(`  ✓ Created ${permissionData.length} user permissions`);

  // ============================================
  // FAMILIES
  // ============================================
  console.log("\n👨‍👩‍👧‍👦 Creating families...");
  const org1Families = await Promise.all([
    prisma.family.upsert({ where: { id: `${ORG1_ID}-fam-1` }, update: {}, create: { id: `${ORG1_ID}-fam-1`, name: "Anderson Family", primaryContact: "Michelle Anderson", email: "anderson.family@email.com", phone: "(555) 101-1001", address: "123 Oak Street, Sunnyvale, CA 94086", balance: 0, organizationId: ORG1_ID } }),
    prisma.family.upsert({ where: { id: `${ORG1_ID}-fam-2` }, update: {}, create: { id: `${ORG1_ID}-fam-2`, name: "Baker Family", primaryContact: "Thomas Baker", email: "baker.family@email.com", phone: "(555) 102-1002", address: "456 Maple Ave, Sunnyvale, CA 94086", balance: 150.00, organizationId: ORG1_ID } }),
    prisma.family.upsert({ where: { id: `${ORG1_ID}-fam-3` }, update: {}, create: { id: `${ORG1_ID}-fam-3`, name: "Chen Family", primaryContact: "Lisa Chen", email: "chen.family@email.com", phone: "(555) 103-1003", address: "789 Pine Road, Mountain View, CA 94040", balance: -25.00, organizationId: ORG1_ID } }),
    prisma.family.upsert({ where: { id: `${ORG1_ID}-fam-4` }, update: {}, create: { id: `${ORG1_ID}-fam-4`, name: "Davis Family", primaryContact: "Marcus Davis", email: "davis.family@email.com", phone: "(555) 104-1004", address: "321 Cedar Lane, Palo Alto, CA 94301", balance: 0, organizationId: ORG1_ID } }),
    prisma.family.upsert({ where: { id: `${ORG1_ID}-fam-5` }, update: {}, create: { id: `${ORG1_ID}-fam-5`, name: "Evans Family", primaryContact: "Nancy Evans", email: "evans.family@email.com", phone: "(555) 105-1005", address: "654 Birch Court, Los Altos, CA 94022", balance: 75.50, organizationId: ORG1_ID } }),
  ]);
  const org2Families = await Promise.all([
    prisma.family.upsert({ where: { id: `${ORG2_ID}-fam-1` }, update: {}, create: { id: `${ORG2_ID}-fam-1`, name: "Foster Family", primaryContact: "Karen Foster", email: "foster.family@email.com", phone: "(555) 201-2001", address: "111 First Street, San Jose, CA 95110", balance: 0, organizationId: ORG2_ID } }),
    prisma.family.upsert({ where: { id: `${ORG2_ID}-fam-2` }, update: {}, create: { id: `${ORG2_ID}-fam-2`, name: "Garcia Family", primaryContact: "Carlos Garcia", email: "garcia.family@email.com", phone: "(555) 202-2002", address: "222 Second Ave, San Jose, CA 95112", balance: 200.00, organizationId: ORG2_ID } }),
    prisma.family.upsert({ where: { id: `${ORG2_ID}-fam-3` }, update: {}, create: { id: `${ORG2_ID}-fam-3`, name: "Harris Family", primaryContact: "Patricia Harris", email: "harris.family@email.com", phone: "(555) 203-2003", address: "333 Third Blvd, Campbell, CA 95008", balance: 0, organizationId: ORG2_ID } }),
    prisma.family.upsert({ where: { id: `${ORG2_ID}-fam-4` }, update: {}, create: { id: `${ORG2_ID}-fam-4`, name: "Irving Family", primaryContact: "John Irving", email: "irving.family@email.com", phone: "(555) 204-2004", address: "444 Fourth Way, Cupertino, CA 95014", balance: -50.00, organizationId: ORG2_ID } }),
  ]);
  console.log(`  ✓ Created ${org1Families.length + org2Families.length} families`);

  // ============================================
  // ATHLETES
  // ============================================
  console.log("\n🏃 Creating athletes...");
  await Promise.all([
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-1` }, update: {}, create: { id: `${ORG1_ID}-ath-1`, name: "Emily Anderson", email: "emily.a@email.com", level: "Bronze", group: "Rec Bronze", status: "ACTIVE", birthDate: new Date("2016-03-15"), organizationId: ORG1_ID, customId: "SGA-001", medicalDetails: { allergies: ["peanuts"], conditions: [], emergencyContact: { name: "Michelle Anderson", phone: "(555) 101-1001" } } } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-2` }, update: {}, create: { id: `${ORG1_ID}-ath-2`, name: "Sophie Anderson", email: "sophie.a@email.com", level: "Silver", group: "Rec Silver", status: "ACTIVE", birthDate: new Date("2014-07-22"), organizationId: ORG1_ID, customId: "SGA-002" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-3` }, update: {}, create: { id: `${ORG1_ID}-ath-3`, name: "Olivia Baker", level: "Level 4", group: "JO Team", status: "ACTIVE", birthDate: new Date("2013-11-08"), organizationId: ORG1_ID, customId: "SGA-003" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-4` }, update: {}, create: { id: `${ORG1_ID}-ath-4`, name: "Lily Chen", level: "Bronze", group: "Rec Bronze", status: "ACTIVE", birthDate: new Date("2017-01-30"), organizationId: ORG1_ID, customId: "SGA-004" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-5` }, update: {}, create: { id: `${ORG1_ID}-ath-5`, name: "Mia Chen", level: "Gold", group: "Rec Gold", status: "ACTIVE", birthDate: new Date("2012-09-14"), organizationId: ORG1_ID, customId: "SGA-005" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-6` }, update: {}, create: { id: `${ORG1_ID}-ath-6`, name: "Grace Davis", level: "Level 5", group: "JO Team", status: "ACTIVE", birthDate: new Date("2011-05-20"), organizationId: ORG1_ID, customId: "SGA-006" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-7` }, update: {}, create: { id: `${ORG1_ID}-ath-7`, name: "Ava Evans", level: "Silver", group: "Rec Silver", status: "TRIAL", birthDate: new Date("2015-12-03"), organizationId: ORG1_ID, customId: "SGA-007" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-8` }, update: {}, create: { id: `${ORG1_ID}-ath-8`, name: "Hannah Evans", level: "Preschool", group: "Tiny Tumblers", status: "ACTIVE", birthDate: new Date("2019-08-11"), organizationId: ORG1_ID, customId: "SGA-008" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-1` }, update: {}, create: { id: `${ORG2_ID}-ath-1`, name: "Jake Foster", email: "jake.f@email.com", level: "Beginner", group: "Youth Soccer", status: "ACTIVE", birthDate: new Date("2014-04-18"), organizationId: ORG2_ID, customId: "MSC-001" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-2` }, update: {}, create: { id: `${ORG2_ID}-ath-2`, name: "Ethan Foster", level: "Intermediate", group: "Teen Basketball", status: "ACTIVE", birthDate: new Date("2010-10-25"), organizationId: ORG2_ID, customId: "MSC-002" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-3` }, update: {}, create: { id: `${ORG2_ID}-ath-3`, name: "Sofia Garcia", level: "Beginner", group: "Kids Fitness", status: "ACTIVE", birthDate: new Date("2016-06-12"), organizationId: ORG2_ID, customId: "MSC-003" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-4` }, update: {}, create: { id: `${ORG2_ID}-ath-4`, name: "Lucas Garcia", level: "Advanced", group: "Swim Team", status: "ACTIVE", birthDate: new Date("2011-02-28"), organizationId: ORG2_ID, customId: "MSC-004" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-5` }, update: {}, create: { id: `${ORG2_ID}-ath-5`, name: "Chloe Harris", level: "Beginner", group: "Youth Soccer", status: "INACTIVE", birthDate: new Date("2015-09-07"), organizationId: ORG2_ID, customId: "MSC-005" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-6` }, update: {}, create: { id: `${ORG2_ID}-ath-6`, name: "Noah Irving", level: "Intermediate", group: "Teen Basketball", status: "ACTIVE", birthDate: new Date("2012-11-19"), organizationId: ORG2_ID, customId: "MSC-006" } }),
  ]);
  console.log("  ✓ Created 14 athletes");

  // ============================================
  // ATHLETE GUARDIANS
  // ============================================
  console.log("\n👪 Creating athlete-guardian relationships...");
  const guardianData = [
    { athleteId: `${ORG1_ID}-ath-1`, familyId: `${ORG1_ID}-fam-1`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-2`, familyId: `${ORG1_ID}-fam-1`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-3`, familyId: `${ORG1_ID}-fam-2`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-4`, familyId: `${ORG1_ID}-fam-3`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-5`, familyId: `${ORG1_ID}-fam-3`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-6`, familyId: `${ORG1_ID}-fam-4`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-7`, familyId: `${ORG1_ID}-fam-5`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-8`, familyId: `${ORG1_ID}-fam-5`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-1`, familyId: `${ORG2_ID}-fam-1`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-2`, familyId: `${ORG2_ID}-fam-1`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-3`, familyId: `${ORG2_ID}-fam-2`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-4`, familyId: `${ORG2_ID}-fam-2`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-5`, familyId: `${ORG2_ID}-fam-3`, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-6`, familyId: `${ORG2_ID}-fam-4`, relationship: "Guardian", isPrimary: true },
  ];
  for (const g of guardianData) {
    await prisma.athleteGuardian.upsert({
      where: { athleteId_familyId: { athleteId: g.athleteId, familyId: g.familyId } },
      update: {}, create: g,
    });
  }
  console.log(`  ✓ Created ${guardianData.length} athlete-guardian relationships`);

  // ============================================
  // PAYMENT METHODS
  // ============================================
  console.log("\n💳 Creating payment methods...");
  const paymentMethodData = [
    { id: `${ORG1_ID}-pm-1`, familyId: `${ORG1_ID}-fam-1`, type: "CARD" as const, last4: "4242", expiry: "12/27", brand: "Visa", isDefault: true },
    { id: `${ORG1_ID}-pm-2`, familyId: `${ORG1_ID}-fam-2`, type: "CARD" as const, last4: "5555", expiry: "08/26", brand: "Mastercard", isDefault: true },
    { id: `${ORG1_ID}-pm-3`, familyId: `${ORG1_ID}-fam-3`, type: "BANK" as const, last4: "6789", expiry: null, brand: null, isDefault: true },
    { id: `${ORG1_ID}-pm-4`, familyId: `${ORG1_ID}-fam-4`, type: "CARD" as const, last4: "1234", expiry: "03/28", brand: "Amex", isDefault: true },
    { id: `${ORG2_ID}-pm-1`, familyId: `${ORG2_ID}-fam-1`, type: "CARD" as const, last4: "9876", expiry: "06/27", brand: "Visa", isDefault: true },
    { id: `${ORG2_ID}-pm-2`, familyId: `${ORG2_ID}-fam-2`, type: "CARD" as const, last4: "3456", expiry: "11/26", brand: "Discover", isDefault: true },
  ];
  for (const pm of paymentMethodData) {
    await prisma.paymentMethod.upsert({ where: { id: pm.id }, update: {}, create: pm });
  }
  console.log(`  ✓ Created ${paymentMethodData.length} payment methods`);

  // ============================================
  // PROGRAMS
  // ============================================
  console.log("\n📚 Creating programs...");
  await Promise.all([
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-bronze` }, update: {}, create: { id: `${ORG1_ID}-prog-rec-bronze`, name: "Recreational Bronze", description: "Introduction to gymnastics for beginners ages 5-7", level: "Bronze", status: "ACTIVE", organizationId: ORG1_ID } }),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-silver` }, update: {}, create: { id: `${ORG1_ID}-prog-rec-silver`, name: "Recreational Silver", description: "Intermediate recreational program for ages 7-10", level: "Silver", status: "ACTIVE", organizationId: ORG1_ID } }),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-gold` }, update: {}, create: { id: `${ORG1_ID}-prog-rec-gold`, name: "Recreational Gold", description: "Advanced recreational program for ages 10+", level: "Gold", status: "ACTIVE", organizationId: ORG1_ID } }),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-jo` }, update: {}, create: { id: `${ORG1_ID}-prog-jo`, name: "Junior Olympics Team", description: "Competitive gymnastics program - Levels 4-10", level: "Competitive", status: "ACTIVE", organizationId: ORG1_ID } }),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-preschool` }, update: {}, create: { id: `${ORG1_ID}-prog-preschool`, name: "Tiny Tumblers", description: "Parent-child gymnastics for ages 2-4", level: "Preschool", status: "ACTIVE", organizationId: ORG1_ID } }),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-soccer` }, update: {}, create: { id: `${ORG2_ID}-prog-soccer`, name: "Youth Soccer League", description: "Recreational soccer for ages 6-14", level: "All Levels", status: "ACTIVE", organizationId: ORG2_ID } }),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-basketball` }, update: {}, create: { id: `${ORG2_ID}-prog-basketball`, name: "Teen Basketball", description: "Basketball skills and games for ages 12-18", level: "Intermediate", status: "ACTIVE", organizationId: ORG2_ID } }),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-swim` }, update: {}, create: { id: `${ORG2_ID}-prog-swim`, name: "Swim Team", description: "Competitive swimming for all ages", level: "Competitive", status: "ACTIVE", organizationId: ORG2_ID } }),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-fitness` }, update: {}, create: { id: `${ORG2_ID}-prog-fitness`, name: "Kids Fitness", description: "General fitness and movement for ages 5-10", level: "Beginner", status: "ACTIVE", organizationId: ORG2_ID } }),
  ]);
  console.log("  ✓ Created 9 programs");

  // ============================================
  // MEMBERSHIP TIERS (Legacy)
  // ============================================
  console.log("\n🎫 Creating membership tiers...");
  const tierData = [
    { id: `${ORG1_ID}-tier-bronze`, programId: `${ORG1_ID}-prog-rec-bronze`, name: "Bronze Monthly", price: 85, interval: "MONTHLY" as const, description: "Monthly recreational bronze", features: ["1 class per week", "Open gym access"], organizationId: ORG1_ID },
    { id: `${ORG1_ID}-tier-silver`, programId: `${ORG1_ID}-prog-rec-silver`, name: "Silver Monthly", price: 115, interval: "MONTHLY" as const, description: "Monthly recreational silver", features: ["2 classes per week", "Open gym access"], organizationId: ORG1_ID },
    { id: `${ORG1_ID}-tier-gold`, programId: `${ORG1_ID}-prog-rec-gold`, name: "Gold Monthly", price: 145, interval: "MONTHLY" as const, description: "Monthly recreational gold", features: ["3 classes per week", "Skills clinics"], organizationId: ORG1_ID },
    { id: `${ORG1_ID}-tier-jo`, programId: `${ORG1_ID}-prog-jo`, name: "JO Team Annual", price: 2400, interval: "YEARLY" as const, description: "Annual JO team", features: ["Unlimited training", "Competition fees"], organizationId: ORG1_ID },
    { id: `${ORG2_ID}-tier-soccer`, programId: `${ORG2_ID}-prog-soccer`, name: "Soccer Season", price: 175, interval: "SESSION" as const, description: "One soccer season", features: ["Weekly games", "Team jersey"], organizationId: ORG2_ID },
    { id: `${ORG2_ID}-tier-basketball`, programId: `${ORG2_ID}-prog-basketball`, name: "Basketball Monthly", price: 95, interval: "MONTHLY" as const, description: "Monthly basketball", features: ["2 sessions per week"], organizationId: ORG2_ID },
    { id: `${ORG2_ID}-tier-swim`, programId: `${ORG2_ID}-prog-swim`, name: "Swim Team Annual", price: 1200, interval: "YEARLY" as const, description: "Annual swim team", features: ["Daily practice", "Meets included"], organizationId: ORG2_ID },
  ];
  for (const tier of tierData) {
    await prisma.membershipTier.upsert({ where: { id: tier.id }, update: {}, create: tier });
  }
  console.log(`  ✓ Created ${tierData.length} membership tiers`);

  // ============================================
  // MEMBERSHIP GROUPS & INSTANCES
  // ============================================
  console.log("\n📋 Creating membership groups and instances...");
  const org1MembershipGroup = await prisma.membershipGroup.upsert({
    where: { id: `${ORG1_ID}-mg-annual` }, update: {},
    create: { id: `${ORG1_ID}-mg-annual`, organizationId: ORG1_ID, name: "Annual Club Membership", description: "Required annual membership", programTypes: ["Recreational", "Competitive"], allowAutoRenew: true },
  });
  const org2MembershipGroup = await prisma.membershipGroup.upsert({
    where: { id: `${ORG2_ID}-mg-seasonal` }, update: {},
    create: { id: `${ORG2_ID}-mg-seasonal`, organizationId: ORG2_ID, name: "Seasonal Pass", description: "Access to all programs for one season", programTypes: ["Soccer", "Basketball", "Swimming"], allowAutoRenew: false },
  });
  await Promise.all([
    prisma.membershipInstance.upsert({ where: { id: `${ORG1_ID}-mi-2026` }, update: {}, create: { id: `${ORG1_ID}-mi-2026`, membershipGroupId: org1MembershipGroup.id, name: "2025-2026 Season", price: 75, billingInterval: "YEARLY", startDate: new Date("2025-09-01"), endDate: new Date("2026-08-31"), autoRenewDate: new Date("2026-07-01"), status: "ACTIVE" } }),
    prisma.membershipInstance.upsert({ where: { id: `${ORG2_ID}-mi-winter26` }, update: {}, create: { id: `${ORG2_ID}-mi-winter26`, membershipGroupId: org2MembershipGroup.id, name: "Winter 2026", price: 150, billingInterval: "SESSION", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), status: "ACTIVE" } }),
    prisma.membershipInstance.upsert({ where: { id: `${ORG2_ID}-mi-spring26` }, update: {}, create: { id: `${ORG2_ID}-mi-spring26`, membershipGroupId: org2MembershipGroup.id, name: "Spring 2026", price: 150, billingInterval: "SESSION", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"), status: "ACTIVE" } }),
  ]);
  console.log("  ✓ Created 2 membership groups and 3 instances");

  // ============================================
  // ATHLETE MEMBERSHIPS
  // ============================================
  console.log("\n🎟️ Creating athlete memberships...");
  const athleteMembershipData = [
    { id: `${ORG1_ID}-am-1`, athleteId: `${ORG1_ID}-ath-1`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: new Date("2025-09-01"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG1_ID}-am-2`, athleteId: `${ORG1_ID}-ath-2`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: new Date("2025-09-01"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG1_ID}-am-3`, athleteId: `${ORG1_ID}-ath-3`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: new Date("2025-09-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG1_ID}-am-4`, athleteId: `${ORG1_ID}-ath-4`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: new Date("2025-09-15"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG2_ID}-am-1`, athleteId: `${ORG2_ID}-ath-1`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: new Date("2026-01-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG2_ID}-am-2`, athleteId: `${ORG2_ID}-ath-2`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: new Date("2026-01-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG2_ID}-am-3`, athleteId: `${ORG2_ID}-ath-3`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: new Date("2026-01-15"), status: "ACTIVE" as const, autoRenew: false },
  ];
  for (const am of athleteMembershipData) {
    await prisma.athleteMembership.upsert({ where: { id: am.id }, update: {}, create: am });
  }
  console.log(`  ✓ Created ${athleteMembershipData.length} athlete memberships`);

  // ============================================
  // ENROLLMENTS
  // ============================================
  console.log("\n📝 Creating enrollments...");
  const enrollmentData = [
    { id: `${ORG1_ID}-enr-1`, athleteId: `${ORG1_ID}-ath-1`, programId: `${ORG1_ID}-prog-rec-bronze`, membershipTierId: `${ORG1_ID}-tier-bronze`, familyId: `${ORG1_ID}-fam-1`, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-2`, athleteId: `${ORG1_ID}-ath-2`, programId: `${ORG1_ID}-prog-rec-silver`, membershipTierId: `${ORG1_ID}-tier-silver`, familyId: `${ORG1_ID}-fam-1`, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-3`, athleteId: `${ORG1_ID}-ath-3`, programId: `${ORG1_ID}-prog-jo`, membershipTierId: `${ORG1_ID}-tier-jo`, familyId: `${ORG1_ID}-fam-2`, startDate: daysAgo(120), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-4`, athleteId: `${ORG1_ID}-ath-4`, programId: `${ORG1_ID}-prog-rec-bronze`, membershipTierId: `${ORG1_ID}-tier-bronze`, familyId: `${ORG1_ID}-fam-3`, startDate: daysAgo(30), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-1`, athleteId: `${ORG2_ID}-ath-1`, programId: `${ORG2_ID}-prog-soccer`, membershipTierId: `${ORG2_ID}-tier-soccer`, familyId: `${ORG2_ID}-fam-1`, startDate: daysAgo(30), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-2`, athleteId: `${ORG2_ID}-ath-2`, programId: `${ORG2_ID}-prog-basketball`, membershipTierId: `${ORG2_ID}-tier-basketball`, familyId: `${ORG2_ID}-fam-1`, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-3`, athleteId: `${ORG2_ID}-ath-4`, programId: `${ORG2_ID}-prog-swim`, membershipTierId: `${ORG2_ID}-tier-swim`, familyId: `${ORG2_ID}-fam-2`, startDate: daysAgo(90), status: "ACTIVE" as const },
  ];
  for (const enr of enrollmentData) {
    await prisma.enrollment.upsert({ where: { id: enr.id }, update: {}, create: enr });
  }
  console.log(`  ✓ Created ${enrollmentData.length} enrollments`);

  // ============================================
  // EVENTS
  // ============================================
  console.log("\n📅 Creating events...");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  await Promise.all([
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-1` }, update: {}, create: { id: `${ORG1_ID}-evt-1`, title: "Bronze Class - Monday", date: today, startTime: "16:00", endTime: "17:00", type: "CLASS", programId: `${ORG1_ID}-prog-rec-bronze`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 12 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-2` }, update: {}, create: { id: `${ORG1_ID}-evt-2`, title: "Silver Class - Monday", date: today, startTime: "17:00", endTime: "18:30", type: "CLASS", programId: `${ORG1_ID}-prog-rec-silver`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 10 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-3` }, update: {}, create: { id: `${ORG1_ID}-evt-3`, title: "JO Team Practice", date: today, startTime: "18:30", endTime: "21:00", type: "CLASS", programId: `${ORG1_ID}-prog-jo`, coachId: org1Coach2.id, organizationId: ORG1_ID, capacity: 20 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-4` }, update: {}, create: { id: `${ORG1_ID}-evt-4`, title: "Spring Invitational", date: daysFromNow(45), startTime: "08:00", endTime: "17:00", type: "COMPETITION", description: "Annual spring invitational meet", programId: `${ORG1_ID}-prog-jo`, organizationId: ORG1_ID, capacity: 100 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-5` }, update: {}, create: { id: `${ORG1_ID}-evt-5`, title: "Summer Camp Week 1", date: daysFromNow(150), startTime: "09:00", endTime: "15:00", type: "CAMP", description: "Full day gymnastics camp", organizationId: ORG1_ID, capacity: 40 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-1` }, update: {}, create: { id: `${ORG2_ID}-evt-1`, title: "Youth Soccer Practice", date: today, startTime: "16:00", endTime: "17:30", type: "CLASS", programId: `${ORG2_ID}-prog-soccer`, coachId: org2Coach.id, organizationId: ORG2_ID, capacity: 24 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-2` }, update: {}, create: { id: `${ORG2_ID}-evt-2`, title: "Basketball Game Night", date: daysFromNow(2), startTime: "18:00", endTime: "20:00", type: "CLASS", programId: `${ORG2_ID}-prog-basketball`, organizationId: ORG2_ID, capacity: 20 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-3` }, update: {}, create: { id: `${ORG2_ID}-evt-3`, title: "Swim Meet", date: daysFromNow(14), startTime: "07:00", endTime: "14:00", type: "COMPETITION", programId: `${ORG2_ID}-prog-swim`, organizationId: ORG2_ID, capacity: 50 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-4` }, update: {}, create: { id: `${ORG2_ID}-evt-4`, title: "Birthday Party - Johnson", date: daysFromNow(10), startTime: "14:00", endTime: "16:00", type: "PARTY", organizationId: ORG2_ID, capacity: 20 } }),
  ]);
  console.log("  ✓ Created 9 events");

  // ============================================
  // HISTORICAL EVENTS (for attendance metrics)
  // ============================================
  console.log("\n📆 Creating historical events for attendance tracking...");
  const historicalEvents: Array<{ id: string; title: string; date: Date; startTime: string; endTime: string; type: "CLASS" | "CAMP" | "PARTY" | "COMPETITION" | "MEETING" | "OTHER"; programId: string; coachId: string; organizationId: string; capacity: number }> = [];
  
  // Create 4 weeks of historical events for ORG1
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    historicalEvents.push(
      { id: `${ORG1_ID}-evt-hist-bronze-${week}`, title: "Bronze Class - Historical", date: weekDate, startTime: "16:00", endTime: "17:00", type: "CLASS", programId: `${ORG1_ID}-prog-rec-bronze`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 12 },
      { id: `${ORG1_ID}-evt-hist-silver-${week}`, title: "Silver Class - Historical", date: weekDate, startTime: "17:00", endTime: "18:30", type: "CLASS", programId: `${ORG1_ID}-prog-rec-silver`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 10 },
      { id: `${ORG1_ID}-evt-hist-jo-${week}`, title: "JO Team Practice - Historical", date: weekDate, startTime: "18:30", endTime: "21:00", type: "CLASS", programId: `${ORG1_ID}-prog-jo`, coachId: org1Coach2.id, organizationId: ORG1_ID, capacity: 20 },
    );
  }
  
  // Create 4 weeks of historical events for ORG2
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    historicalEvents.push(
      { id: `${ORG2_ID}-evt-hist-soccer-${week}`, title: "Soccer Practice - Historical", date: weekDate, startTime: "16:00", endTime: "17:30", type: "CLASS", programId: `${ORG2_ID}-prog-soccer`, coachId: org2Coach.id, organizationId: ORG2_ID, capacity: 24 },
      { id: `${ORG2_ID}-evt-hist-basketball-${week}`, title: "Basketball Practice - Historical", date: weekDate, startTime: "18:00", endTime: "20:00", type: "CLASS", programId: `${ORG2_ID}-prog-basketball`, coachId: org2Coach.id, organizationId: ORG2_ID, capacity: 20 },
    );
  }
  
  for (const evt of historicalEvents) {
    await prisma.event.upsert({ where: { id: evt.id }, update: {}, create: evt });
  }
  console.log(`  ✓ Created ${historicalEvents.length} historical events`);

  // ============================================
  // ATTENDANCE
  // ============================================
  console.log("\n✅ Creating comprehensive attendance records...");
  const attendanceStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
  const attendanceData: Array<{ athleteId: string; eventId: string; status: typeof attendanceStatuses[number] | "REGISTERED"; checkedIn?: Date; notes?: string }> = [];
  
  // Today's events attendance
  attendanceData.push(
    { athleteId: `${ORG1_ID}-ath-1`, eventId: `${ORG1_ID}-evt-1`, status: "PRESENT", checkedIn: today },
    { athleteId: `${ORG1_ID}-ath-4`, eventId: `${ORG1_ID}-evt-1`, status: "PRESENT", checkedIn: today },
    { athleteId: `${ORG1_ID}-ath-2`, eventId: `${ORG1_ID}-evt-2`, status: "PRESENT", checkedIn: today },
    { athleteId: `${ORG1_ID}-ath-3`, eventId: `${ORG1_ID}-evt-3`, status: "PRESENT", checkedIn: today },
    { athleteId: `${ORG1_ID}-ath-3`, eventId: `${ORG1_ID}-evt-4`, status: "REGISTERED" },
    { athleteId: `${ORG2_ID}-ath-1`, eventId: `${ORG2_ID}-evt-1`, status: "PRESENT", checkedIn: today },
    { athleteId: `${ORG2_ID}-ath-2`, eventId: `${ORG2_ID}-evt-2`, status: "REGISTERED" },
    { athleteId: `${ORG2_ID}-ath-4`, eventId: `${ORG2_ID}-evt-3`, status: "REGISTERED" },
  );
  
  // Historical attendance - ORG1 (Bronze class - Athlete 1 and 4)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    // Athlete 1 - good attendance (mostly present, occasional late)
    const ath1Status = week === 2 ? "LATE" : week === 4 ? "EXCUSED" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-1`, 
      eventId: `${ORG1_ID}-evt-hist-bronze-${week}`, 
      status: ath1Status, 
      checkedIn: ath1Status !== "EXCUSED" ? weekDate : undefined,
      notes: ath1Status === "EXCUSED" ? "Family vacation" : undefined
    });
    
    // Athlete 4 - some absences
    const ath4Status = week === 1 ? "ABSENT" : week === 3 ? "LATE" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-4`, 
      eventId: `${ORG1_ID}-evt-hist-bronze-${week}`, 
      status: ath4Status, 
      checkedIn: ath4Status === "PRESENT" || ath4Status === "LATE" ? weekDate : undefined,
      notes: ath4Status === "ABSENT" ? "Sick" : undefined
    });
  }
  
  // Historical attendance - ORG1 (Silver class - Athlete 2)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 3 ? "ABSENT" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-2`, 
      eventId: `${ORG1_ID}-evt-hist-silver-${week}`, 
      status, 
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "ABSENT" ? "School event" : undefined
    });
  }
  
  // Historical attendance - ORG1 (JO Team - Athlete 3) - Perfect attendance
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-3`, 
      eventId: `${ORG1_ID}-evt-hist-jo-${week}`, 
      status: "PRESENT", 
      checkedIn: weekDate 
    });
  }
  
  // Historical attendance - ORG2 (Soccer - Athlete 1)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 2 ? "LATE" : week === 4 ? "ABSENT" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-1`, 
      eventId: `${ORG2_ID}-evt-hist-soccer-${week}`, 
      status, 
      checkedIn: status !== "ABSENT" ? weekDate : undefined 
    });
  }
  
  // Historical attendance - ORG2 (Basketball - Athlete 2)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 1 ? "EXCUSED" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-2`, 
      eventId: `${ORG2_ID}-evt-hist-basketball-${week}`, 
      status, 
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "EXCUSED" ? "Doctor appointment" : undefined
    });
  }
  
  // Historical attendance - ORG2 (Athlete 4 in swim events - add to some soccer events too)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-4`, 
      eventId: `${ORG2_ID}-evt-hist-soccer-${week}`, 
      status: week % 2 === 0 ? "PRESENT" : "ABSENT", 
      checkedIn: week % 2 === 0 ? weekDate : undefined 
    });
  }
  
  for (const att of attendanceData) {
    await prisma.attendance.upsert({
      where: { athleteId_eventId: { athleteId: att.athleteId, eventId: att.eventId } },
      update: {}, create: att,
    });
  }
  console.log(`  ✓ Created ${attendanceData.length} attendance records (including ${attendanceData.length - 8} historical records)`);

  // ============================================
  // INVOICES & LINE ITEMS
  // ============================================
  console.log("\n🧾 Creating invoices...");
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-1` }, update: {},
    create: {
      id: `${ORG1_ID}-inv-1`, reference: "SGA-2026-0001", familyId: `${ORG1_ID}-fam-1`, status: "PAID",
      dueDate: daysAgo(15), subtotal: 200, tax: 18, total: 218, notes: "January tuition", organizationId: ORG1_ID,
      lineItems: { create: [
        { description: "Bronze Monthly - Emily", quantity: 1, unitPrice: 85, total: 85, programId: `${ORG1_ID}-prog-rec-bronze`, athleteId: `${ORG1_ID}-ath-1` },
        { description: "Silver Monthly - Sophie", quantity: 1, unitPrice: 115, total: 115, programId: `${ORG1_ID}-prog-rec-silver`, athleteId: `${ORG1_ID}-ath-2` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-2` }, update: {},
    create: {
      id: `${ORG1_ID}-inv-2`, reference: "SGA-2026-0002", familyId: `${ORG1_ID}-fam-2`, status: "SENT",
      dueDate: daysFromNow(15), subtotal: 200, tax: 18, total: 218, organizationId: ORG1_ID,
      lineItems: { create: [
        { description: "JO Team Monthly - Olivia", quantity: 1, unitPrice: 200, total: 200, programId: `${ORG1_ID}-prog-jo`, athleteId: `${ORG1_ID}-ath-3` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-3` }, update: {},
    create: {
      id: `${ORG1_ID}-inv-3`, reference: "SGA-2026-0003", familyId: `${ORG1_ID}-fam-3`, status: "OVERDUE",
      dueDate: daysAgo(10), subtotal: 85, tax: 7.65, total: 92.65, organizationId: ORG1_ID,
      lineItems: { create: [
        { description: "Bronze Monthly - Lily", quantity: 1, unitPrice: 85, total: 85, programId: `${ORG1_ID}-prog-rec-bronze`, athleteId: `${ORG1_ID}-ath-4` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG2_ID}-inv-1` }, update: {},
    create: {
      id: `${ORG2_ID}-inv-1`, reference: "MSC-2026-0001", familyId: `${ORG2_ID}-fam-1`, status: "PAID",
      dueDate: daysAgo(5), subtotal: 270, tax: 24.30, total: 294.30, organizationId: ORG2_ID,
      lineItems: { create: [
        { description: "Soccer Season - Jake", quantity: 1, unitPrice: 175, total: 175, programId: `${ORG2_ID}-prog-soccer`, athleteId: `${ORG2_ID}-ath-1` },
        { description: "Basketball Monthly - Ethan", quantity: 1, unitPrice: 95, total: 95, programId: `${ORG2_ID}-prog-basketball`, athleteId: `${ORG2_ID}-ath-2` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG2_ID}-inv-2` }, update: {},
    create: {
      id: `${ORG2_ID}-inv-2`, reference: "MSC-2026-0002", familyId: `${ORG2_ID}-fam-2`, status: "PARTIAL",
      dueDate: daysAgo(2), subtotal: 1200, tax: 108, total: 1308, organizationId: ORG2_ID,
      lineItems: { create: [
        { description: "Swim Team Annual - Lucas", quantity: 1, unitPrice: 1200, total: 1200, programId: `${ORG2_ID}-prog-swim`, athleteId: `${ORG2_ID}-ath-4` },
      ]},
    },
  });
  console.log("  ✓ Created 5 invoices with line items");

  // ============================================
  // PAYMENTS
  // ============================================
  console.log("\n💰 Creating payments...");
  const paymentData = [
    { id: `${ORG1_ID}-pay-1`, invoiceId: `${ORG1_ID}-inv-1`, familyId: `${ORG1_ID}-fam-1`, amount: 218, method: "CARD" as const, status: "COMPLETED" as const, transactionId: "txn_seed_001", processedAt: daysAgo(20) },
    { id: `${ORG2_ID}-pay-1`, invoiceId: `${ORG2_ID}-inv-1`, familyId: `${ORG2_ID}-fam-1`, amount: 294.30, method: "CARD" as const, status: "COMPLETED" as const, transactionId: "txn_seed_002", processedAt: daysAgo(7) },
    { id: `${ORG2_ID}-pay-2`, invoiceId: `${ORG2_ID}-inv-2`, familyId: `${ORG2_ID}-fam-2`, amount: 600, method: "BANK" as const, status: "COMPLETED" as const, transactionId: "txn_seed_003", processedAt: daysAgo(3) },
  ];
  for (const pay of paymentData) {
    await prisma.payment.upsert({ where: { id: pay.id }, update: {}, create: pay });
  }
  console.log(`  ✓ Created ${paymentData.length} payments`);

  // ============================================
  // DISCOUNTS
  // ============================================
  console.log("\n🏷️ Creating discounts...");
  const discountData = [
    { id: `${ORG1_ID}-disc-1`, name: "New Family Welcome", code: "WELCOME15", type: "PERCENTAGE" as const, amount: 15, validFrom: daysAgo(90), validTo: daysFromNow(90), userScope: "NEW_USERS" as const, productScope: "ALL" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-disc-2`, name: "Sibling Discount", code: "SIBLING10", type: "PERCENTAGE" as const, amount: 10, validFrom: daysAgo(365), userScope: "MEMBERS" as const, productScope: "MEMBERSHIP" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG2_ID}-disc-1`, name: "Multi-Sport Bundle", code: "MULTISPORT20", type: "PERCENTAGE" as const, amount: 20, validFrom: daysAgo(60), userScope: "MEMBERS" as const, productScope: "MEMBERSHIP" as const, status: "ACTIVE" as const, organizationId: ORG2_ID },
  ];
  for (const disc of discountData) {
    await prisma.discount.upsert({ where: { id: disc.id }, update: {}, create: disc });
  }
  console.log(`  ✓ Created ${discountData.length} discounts`);

  // ============================================
  // GL CODES
  // ============================================
  console.log("\n📊 Creating GL codes...");
  const glCodeData = [
    { id: `${ORG1_ID}-gl-1`, code: "SGA-4100", description: "Tuition Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-2`, code: "SGA-5100", description: "Coach Salaries", type: "EXPENSE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-3`, code: "SGA-5200", description: "Equipment", type: "EXPENSE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG2_ID}-gl-1`, code: "MSC-4100", description: "Program Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-2`, code: "MSC-5100", description: "Staff Wages", type: "EXPENSE" as const, status: "ACTIVE" as const, organizationId: ORG2_ID },
  ];
  for (const gl of glCodeData) {
    await prisma.gLCode.upsert({ 
      where: { id: gl.id }, 
      update: { code: gl.code, description: gl.description, type: gl.type, status: gl.status },
      create: gl 
    });
  }
  console.log(`  ✓ Created ${glCodeData.length} GL codes`);

  // ============================================
  // LEDGER ENTRIES
  // ============================================
  console.log("\n📒 Creating ledger entries...");
  const ledgerData = [
    { id: `${ORG1_ID}-le-1`, date: daysAgo(20), description: "Anderson Family - January tuition", glCodeId: `${ORG1_ID}-gl-1`, reference: "SGA-2026-0001", credit: 218, status: "POSTED" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-le-2`, date: daysAgo(15), description: "Monthly coach salary", glCodeId: `${ORG1_ID}-gl-2`, debit: 3500, status: "POSTED" as const, organizationId: ORG1_ID },
    { id: `${ORG2_ID}-le-1`, date: daysAgo(7), description: "Foster Family - Program fees", glCodeId: `${ORG2_ID}-gl-1`, reference: "MSC-2026-0001", credit: 294.30, status: "POSTED" as const, organizationId: ORG2_ID },
  ];
  for (const le of ledgerData) {
    await prisma.ledgerEntry.upsert({ where: { id: le.id }, update: {}, create: le });
  }
  console.log(`  ✓ Created ${ledgerData.length} ledger entries`);

  // ============================================
  // SKILLS
  // ============================================
  console.log("\n🎯 Creating skills...");
  await Promise.all([
    prisma.skill.upsert({ where: { id: `${ORG1_ID}-skill-1` }, update: {}, create: { id: `${ORG1_ID}-skill-1`, name: "Forward Roll", category: "Floor", level: "Bronze", description: "Basic forward roll", organizationId: ORG1_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG1_ID}-skill-2` }, update: {}, create: { id: `${ORG1_ID}-skill-2`, name: "Backward Roll", category: "Floor", level: "Bronze", description: "Backward roll to standing", organizationId: ORG1_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG1_ID}-skill-3` }, update: {}, create: { id: `${ORG1_ID}-skill-3`, name: "Cartwheel", category: "Floor", level: "Bronze", description: "Cartwheel with straight legs", organizationId: ORG1_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG1_ID}-skill-4` }, update: {}, create: { id: `${ORG1_ID}-skill-4`, name: "Handstand", category: "Floor", level: "Silver", description: "Controlled handstand hold", organizationId: ORG1_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG1_ID}-skill-5` }, update: {}, create: { id: `${ORG1_ID}-skill-5`, name: "Pullover", category: "Bars", level: "Bronze", description: "Pullover to front support", organizationId: ORG1_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG2_ID}-skill-1` }, update: {}, create: { id: `${ORG2_ID}-skill-1`, name: "Dribbling", category: "Soccer", level: "Beginner", description: "Basic ball control", organizationId: ORG2_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG2_ID}-skill-2` }, update: {}, create: { id: `${ORG2_ID}-skill-2`, name: "Passing", category: "Soccer", level: "Beginner", description: "Accurate short passes", organizationId: ORG2_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG2_ID}-skill-3` }, update: {}, create: { id: `${ORG2_ID}-skill-3`, name: "Layup", category: "Basketball", level: "Beginner", description: "Basic layup from both sides", organizationId: ORG2_ID } }),
    prisma.skill.upsert({ where: { id: `${ORG2_ID}-skill-4` }, update: {}, create: { id: `${ORG2_ID}-skill-4`, name: "Freestyle Stroke", category: "Swimming", level: "Beginner", description: "Proper freestyle technique", organizationId: ORG2_ID } }),
  ]);
  console.log("  ✓ Created 9 skills");

  // ============================================
  // LESSON PLANS
  // ============================================
  console.log("\n📖 Creating lesson plans...");
  const lessonPlan1 = await prisma.lessonPlan.upsert({
    where: { id: `${ORG1_ID}-lp-1` }, update: {},
    create: { id: `${ORG1_ID}-lp-1`, name: "Bronze Week 1 - Basics", programId: `${ORG1_ID}-prog-rec-bronze`, date: today, authorId: org1Coach1.id, status: "ACTIVE", theme: "Introduction to Fundamentals", organizationId: ORG1_ID },
  });
  const rotation1 = await prisma.rotation.upsert({
    where: { id: `${ORG1_ID}-rot-1` }, update: {},
    create: { id: `${ORG1_ID}-rot-1`, lessonPlanId: lessonPlan1.id, name: "Warm-up", description: "Dynamic stretching", order: 1, media: [] },
  });
  const rotation2 = await prisma.rotation.upsert({
    where: { id: `${ORG1_ID}-rot-2` }, update: {},
    create: { id: `${ORG1_ID}-rot-2`, lessonPlanId: lessonPlan1.id, name: "Floor Skills", description: "Practice forward and backward rolls", order: 2, media: [] },
  });
  await Promise.all([
    prisma.rotationSkill.upsert({ where: { rotationId_skillId: { rotationId: rotation2.id, skillId: `${ORG1_ID}-skill-1` } }, update: {}, create: { rotationId: rotation2.id, skillId: `${ORG1_ID}-skill-1` } }),
    prisma.rotationSkill.upsert({ where: { rotationId_skillId: { rotationId: rotation2.id, skillId: `${ORG1_ID}-skill-2` } }, update: {}, create: { rotationId: rotation2.id, skillId: `${ORG1_ID}-skill-2` } }),
  ]);
  console.log("  ✓ Created 1 lesson plan with rotations");

  // ============================================
  // EVALUATIONS
  // ============================================
  console.log("\n📝 Creating evaluations...");
  const eval1 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-1` }, update: {},
    create: { id: `${ORG1_ID}-eval-1`, athleteId: `${ORG1_ID}-ath-1`, coachId: org1Coach1.id, date: daysAgo(14), level: "Bronze", overallScore: 4.2, status: "PASS", notes: "Great progress!" },
  });
  await Promise.all([
    prisma.evaluationSkill.upsert({ where: { evaluationId_skillId: { evaluationId: eval1.id, skillId: `${ORG1_ID}-skill-1` } }, update: {}, create: { evaluationId: eval1.id, skillId: `${ORG1_ID}-skill-1`, rating: 5, comment: "Perfect form" } }),
    prisma.evaluationSkill.upsert({ where: { evaluationId_skillId: { evaluationId: eval1.id, skillId: `${ORG1_ID}-skill-2` } }, update: {}, create: { evaluationId: eval1.id, skillId: `${ORG1_ID}-skill-2`, rating: 4, comment: "Needs tighter tuck" } }),
  ]);
  console.log("  ✓ Created 1 evaluation with skill ratings");

  // ============================================
  // ANNOUNCEMENTS
  // ============================================
  console.log("\n📢 Creating announcements...");
  const announcementData = [
    { id: `${ORG1_ID}-ann-1`, title: "Spring Competition Registration Open", content: "Registration for our Annual Spring Invitational is now open!", targetScope: "ALL" as const, status: "PUBLISHED" as const, publishedAt: daysAgo(3), organizationId: ORG1_ID },
    { id: `${ORG1_ID}-ann-2`, title: "JO Team Meeting", content: "Mandatory parent meeting for all JO team families.", targetScope: "PROGRAM" as const, targetProgramId: `${ORG1_ID}-prog-jo`, status: "PUBLISHED" as const, publishedAt: daysAgo(1), organizationId: ORG1_ID },
    { id: `${ORG2_ID}-ann-1`, title: "Swim Meet Carpool", content: "We're organizing carpools for the upcoming swim meet.", targetScope: "PROGRAM" as const, targetProgramId: `${ORG2_ID}-prog-swim`, status: "PUBLISHED" as const, publishedAt: daysAgo(2), organizationId: ORG2_ID },
  ];
  for (const ann of announcementData) {
    await prisma.announcement.upsert({ where: { id: ann.id }, update: {}, create: ann });
  }
  console.log(`  ✓ Created ${announcementData.length} announcements`);

  // ============================================
  // WEBSITE CONFIGS
  // ============================================
  console.log("\n🌐 Creating website configurations...");
  
  // Create configs for the new seed orgs
  await Promise.all([
    prisma.websiteConfig.upsert({
      where: { organizationId: ORG1_ID }, update: {},
      create: { organizationId: ORG1_ID, subdomain: "sunrise-gymnastics", primaryColor: "#FF6B35", secondaryColor: "#004E89", heroHeadline: "Where Champions Begin", heroSubheadline: "Building confidence through gymnastics", showCalendar: true, showRegistration: true, showLogin: true, showContact: true, isPublished: true },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: ORG2_ID }, update: {},
      create: { organizationId: ORG2_ID, subdomain: "metro-sports", primaryColor: "#2D5A27", secondaryColor: "#F5A623", heroHeadline: "Play. Compete. Thrive.", heroSubheadline: "Your community sports destination", showCalendar: true, showRegistration: true, showLogin: true, showContact: true, isPublished: true },
    }),
  ]);
  
  // Also create website configs for existing orgs from seed.ts (if they exist)
  const existingOrgs = await prisma.organization.findMany({
    where: { slug: { in: ["demo-gym", "uplifter"] } },
  });
  
  for (const existingOrg of existingOrgs) {
    await prisma.websiteConfig.upsert({
      where: { organizationId: existingOrg.id },
      update: {},
      create: {
        organizationId: existingOrg.id,
        subdomain: existingOrg.slug,
        primaryColor: existingOrg.slug === "demo-gym" ? "#3B82F6" : "#8B5CF6",
        secondaryColor: existingOrg.slug === "demo-gym" ? "#10B981" : "#EC4899",
        heroHeadline: existingOrg.slug === "demo-gym" ? "Welcome to Demo Gym" : "Uplifter Platform",
        heroSubheadline: existingOrg.slug === "demo-gym" ? "Your gymnastics journey starts here" : "Empowering sports organizations",
        showCalendar: true,
        showRegistration: true,
        showLogin: true,
        showContact: true,
        isPublished: true,
      },
    });
  }
  
  console.log(`  ✓ Created ${2 + existingOrgs.length} website configurations`);

  // ============================================
  // PRODUCTS (POS)
  // ============================================
  console.log("\n🛍️ Creating products...");
  await Promise.all([
    prisma.product.upsert({ where: { id: `${ORG1_ID}-prod-1` }, update: {}, create: { id: `${ORG1_ID}-prod-1`, organizationId: ORG1_ID, name: "Competition Leotard", description: "Official team competition leotard", sku: "LEO-COMP-001", category: "Apparel", price: 89.99, maxInventory: 50, currentInventory: 35, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG1_ID}-prod-2` }, update: {}, create: { id: `${ORG1_ID}-prod-2`, organizationId: ORG1_ID, name: "Practice Leotard", sku: "LEO-PRAC-001", category: "Apparel", price: 45.00, maxInventory: 100, currentInventory: 72, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG1_ID}-prod-3` }, update: {}, create: { id: `${ORG1_ID}-prod-3`, organizationId: ORG1_ID, name: "Gymnastics Grips", sku: "GRIP-001", category: "Equipment", price: 65.00, maxInventory: 30, currentInventory: 18, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG1_ID}-prod-4` }, update: {}, create: { id: `${ORG1_ID}-prod-4`, organizationId: ORG1_ID, name: "Water Bottle", sku: "BOTTLE-001", category: "Accessories", price: 12.00, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG2_ID}-prod-1` }, update: {}, create: { id: `${ORG2_ID}-prod-1`, organizationId: ORG2_ID, name: "Soccer Jersey", sku: "JERSEY-SOC-001", category: "Apparel", price: 35.00, maxInventory: 80, currentInventory: 52, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG2_ID}-prod-2` }, update: {}, create: { id: `${ORG2_ID}-prod-2`, organizationId: ORG2_ID, name: "Swim Cap", sku: "CAP-SWIM-001", category: "Equipment", price: 15.00, maxInventory: 100, currentInventory: 78, isActive: true } }),
    prisma.product.upsert({ where: { id: `${ORG2_ID}-prod-3` }, update: {}, create: { id: `${ORG2_ID}-prod-3`, organizationId: ORG2_ID, name: "Sports Bag", sku: "BAG-001", category: "Accessories", price: 45.00, maxInventory: 30, currentInventory: 22, isActive: true } }),
  ]);
  console.log("  ✓ Created 7 products");

  // ============================================
  // STOCK MOVEMENTS
  // ============================================
  console.log("\n📦 Creating stock movements...");
  const stockMovementData = [
    { id: `${ORG1_ID}-sm-1`, productId: `${ORG1_ID}-prod-1`, type: "RESTOCK" as const, quantity: 50, previousQty: 0, newQty: 50, notes: "Initial inventory" },
    { id: `${ORG1_ID}-sm-2`, productId: `${ORG1_ID}-prod-1`, type: "SALE" as const, quantity: -15, previousQty: 50, newQty: 35, notes: "Competition season sales" },
    { id: `${ORG2_ID}-sm-1`, productId: `${ORG2_ID}-prod-1`, type: "RESTOCK" as const, quantity: 80, previousQty: 0, newQty: 80, notes: "Season start inventory" },
    { id: `${ORG2_ID}-sm-2`, productId: `${ORG2_ID}-prod-1`, type: "SALE" as const, quantity: -28, previousQty: 80, newQty: 52, notes: "Team jersey distribution" },
  ];
  for (const sm of stockMovementData) {
    await prisma.stockMovement.upsert({ where: { id: sm.id }, update: {}, create: sm });
  }
  console.log(`  ✓ Created ${stockMovementData.length} stock movements`);

  // ============================================
  // FEATURE REQUESTS
  // ============================================
  console.log("\n💡 Creating feature requests...");
  const feature1 = await prisma.featureRequest.upsert({
    where: { id: "feature-1" }, update: {},
    create: { id: "feature-1", title: "Mobile app for parents", description: "It would be great to have a mobile app where parents can check schedules and make payments.", status: "IN_PROGRESS", votes: 47, userId: org1Admin.id },
  });
  await prisma.featureRequest.upsert({
    where: { id: "feature-2" }, update: {},
    create: { id: "feature-2", title: "Automated attendance tracking", description: "QR code or RFID-based check-in system.", status: "OPEN", votes: 32, userId: org2Admin.id },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-1" }, update: {},
    create: { id: "fc-1", featureRequestId: feature1.id, content: "This would be amazing!", userId: org1Coach1.id },
  });
  console.log("  ✓ Created 2 feature requests with comments");

  // ============================================
  // MEDIA
  // ============================================
  console.log("\n📷 Creating media...");
  const mediaData = [
    // Sunrise Gymnastics - Coach uploaded media
    { 
      id: `${ORG1_ID}-media-1`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "Bronze Class Practice - Floor Routine", 
      description: "Emily working on her floor routine fundamentals",
      athleteId: `${ORG1_ID}-ath-1`,
      eventId: `${ORG1_ID}-evt-1`,
      uploadedById: org1Coach1.id, 
      organizationId: ORG1_ID 
    },
    { 
      id: `${ORG1_ID}-media-2`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "Silver Team Group Photo", 
      description: "Team photo after a great practice session",
      athleteId: null,
      eventId: `${ORG1_ID}-evt-2`,
      uploadedById: org1Coach1.id, 
      organizationId: ORG1_ID 
    },
    { 
      id: `${ORG1_ID}-media-3`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "Cartwheel Progress", 
      description: "Sophie's cartwheel improvement over the month",
      athleteId: `${ORG1_ID}-ath-2`,
      eventId: null,
      uploadedById: org1Coach2.id, 
      organizationId: ORG1_ID 
    },
    { 
      id: `${ORG1_ID}-media-4`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "JO Team Practice", 
      description: "Level 4 athletes during beam practice",
      athleteId: `${ORG1_ID}-ath-3`,
      eventId: `${ORG1_ID}-evt-3`,
      uploadedById: org1Coach1.id, 
      organizationId: ORG1_ID 
    },
    // Metro Sports - Coach uploaded media
    { 
      id: `${ORG2_ID}-media-1`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "Soccer Drills", 
      description: "Youth soccer team working on passing drills",
      athleteId: `${ORG2_ID}-ath-1`,
      eventId: `${ORG2_ID}-evt-1`,
      uploadedById: org2Coach.id, 
      organizationId: ORG2_ID 
    },
    { 
      id: `${ORG2_ID}-media-2`, 
      url: "/defaults/hero-default.ico", 
      type: "IMAGE" as const, 
      title: "Basketball Scrimmage", 
      description: "Teen basketball team during practice game",
      athleteId: `${ORG2_ID}-ath-2`,
      eventId: `${ORG2_ID}-evt-2`,
      uploadedById: org2Coach.id, 
      organizationId: ORG2_ID 
    },
  ];
  for (const m of mediaData) {
    await prisma.media.upsert({ where: { id: m.id }, update: {}, create: m });
  }
  console.log(`  ✓ Created ${mediaData.length} media items`);

  // ============================================
  // VISITOR ANALYTICS (Redis)
  // ============================================
  if (redis) {
    console.log("\n📊 Seeding visitor analytics...");
    
    // Get all organizations with published website configs
    const publishedSites = await prisma.websiteConfig.findMany({
      where: { isPublished: true },
      select: { organizationId: true },
    });
    
    const formatDate = (date: Date): string => date.toISOString().split("T")[0];
    const VISITOR_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days
    
    let totalDaysSeeded = 0;
    let totalDesktopVisitors = 0;
    let totalMobileVisitors = 0;
    
    for (const site of publishedSites) {
      const orgId = site.organizationId;
      
      // Seed 90 days of historical data (excluding today)
      // Today will have 0 visitors for easy testing
      for (let daysBack = 1; daysBack <= 90; daysBack++) {
        const date = new Date();
        date.setDate(date.getDate() - daysBack);
        const dateStr = formatDate(date);
        
        // Calculate visitor count with realistic patterns
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Base visitors: lower on weekends
        const baseVisitors = isWeekend ? 50 : 150;
        
        // Add variance (0-100)
        const variance = Math.floor(Math.random() * 100);
        
        // Occasional spikes (10% chance of 2x traffic)
        const spike = Math.random() < 0.1 ? 2 : 1;
        
        // More recent days tend to have more traffic (growth trend)
        const recencyBonus = Math.floor((90 - daysBack) / 10) * 10;
        
        const totalVisitors = Math.floor((baseVisitors + variance + recencyBonus) * spike);
        
        // Split between desktop (~60%) and mobile (~40%) with some variance
        const mobileRatio = 0.35 + (Math.random() * 0.1); // 35-45% mobile
        const mobileCount = Math.floor(totalVisitors * mobileRatio);
        const desktopCount = totalVisitors - mobileCount;
        
        // Generate desktop visitor IDs
        const desktopKey = `visitors:${orgId}:${dateStr}:desktop`;
        if (desktopCount > 0) {
          const desktopIds: [string, ...string[]] = [`seed-desktop-${dateStr}-0`];
          for (let i = 1; i < desktopCount; i++) {
            desktopIds.push(`seed-desktop-${dateStr}-${i}`);
          }
          await redis
            .pipeline()
            .sadd(desktopKey, ...desktopIds)
            .expire(desktopKey, VISITOR_TTL_SECONDS)
            .exec();
          totalDesktopVisitors += desktopCount;
        }
        
        // Generate mobile visitor IDs
        const mobileKey = `visitors:${orgId}:${dateStr}:mobile`;
        if (mobileCount > 0) {
          const mobileIds: [string, ...string[]] = [`seed-mobile-${dateStr}-0`];
          for (let i = 1; i < mobileCount; i++) {
            mobileIds.push(`seed-mobile-${dateStr}-${i}`);
          }
          await redis
            .pipeline()
            .sadd(mobileKey, ...mobileIds)
            .expire(mobileKey, VISITOR_TTL_SECONDS)
            .exec();
          totalMobileVisitors += mobileCount;
        }
        
        totalDaysSeeded++;
      }
    }
    
    console.log(`  ✓ Seeded ${totalDaysSeeded} days of visitor analytics for ${publishedSites.length} sites`);
    console.log(`  ✓ Total: ${(totalDesktopVisitors + totalMobileVisitors).toLocaleString()} visitors (${totalDesktopVisitors.toLocaleString()} desktop, ${totalMobileVisitors.toLocaleString()} mobile)`);
    console.log("  ℹ Today has 0 visitors (for testing)");
  } else {
    console.log("\n📊 Skipping visitor analytics (Redis not configured)");
    console.log("  ℹ Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable");
  }

  // ============================================
  // COMPLETE
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Development seed completed successfully!");
  console.log("=".repeat(50));
  console.log("\nCreated data summary:");
  console.log("  • 2 organizations (Sunrise Gymnastics, Metro Sports)");
  console.log("  • 4 subscription plans");
  console.log("  • 7 users with permissions");
  console.log("  • 9 families with payment methods");
  console.log("  • 14 athletes with guardian relationships");
  console.log("  • 9 programs with membership tiers");
  console.log("  • 29+ events with 40+ attendance records (historical + current)");
  console.log("  • 5 invoices with line items and payments");
  console.log("  • 9 transactions (Adyen)");
  console.log("  • 5 payouts (settlements)");
  console.log("  • 7 recurring charges");
  console.log("  • 9 skills with lesson plans");
  console.log("  • 7 POS products with stock movements");
  console.log("  • 6 media items (photos/videos)");
  console.log("  • 90 days of visitor analytics (if Redis configured)");
  console.log("\nTest accounts (password: password123):");
  console.log("  Sunrise Gym Admin: admin@sunrise-gymnastics.com");
  console.log("  Metro Sports Admin: admin@metro-sports.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
