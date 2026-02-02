/**
 * Main Seed Script
 * ================
 * 
 * This script populates the database with comprehensive data for development
 * and testing purposes. It creates multiple organizations with different data
 * to test multi-tenancy and various features.
 * 
 * Organizations:
 * 1. Sunrise Gymnastics Academy - Youth gymnastics club (comprehensive data)
 * 2. Metro Sports Complex - Multi-sport community facility (comprehensive data)
 * 3. Demo Gymnastics Club - Demo/testing organization
 * 4. Uplifter - Platform owner organization
 * 
 * Usage:
 *   pnpm db:seed
 * 
 * To reset and reseed:
 *   pnpm db:reset
 * 
 * Last Updated: 2026-01-29
 * 
 * MAINTENANCE NOTES:
 * - When adding new models to schema.prisma, add seed data in the corresponding section
 * - Use deterministic IDs (prefixed with org slug) for idempotent seeding
 * - Use upsert pattern to allow re-running without errors
 * - Keep realistic data that exercises edge cases
 */

import { PrismaClient, Prisma } from "@prisma/client";
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
const ORG_DEMO_ID = "seed-org-demo-gym";
const ORG_UPLIFTER_ID = "seed-org-uplifter";
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

  // Demo Gym and Uplifter (from original seed.ts)
  const orgDemo = await prisma.organization.upsert({
    where: { slug: "demo-gym" }, update: {},
    create: { id: ORG_DEMO_ID, name: "Demo Gymnastics Club", slug: "demo-gym" },
  });
  const orgUplifter = await prisma.organization.upsert({
    where: { slug: "uplifter" }, update: {},
    create: { id: ORG_UPLIFTER_ID, name: "Uplifter", slug: "uplifter" },
  });
  console.log(`  ✓ Created: ${orgDemo.name}`);
  console.log(`  ✓ Created: ${orgUplifter.name}`);

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
    prisma.organizationSubscription.upsert({
      where: { organizationId: orgDemo.id }, update: {},
      create: {
        organizationId: orgDemo.id, planId: goldPlan.id, status: "ACTIVE", billingCycle: "MONTHLY",
        currentPeriodStart: daysAgo(10), currentPeriodEnd: daysFromNow(20),
        stripeCustomerId: "cus_seed_demo", stripeSubscriptionId: "sub_seed_demo",
      },
    }),
    prisma.organizationSubscription.upsert({
      where: { organizationId: orgUplifter.id }, update: {},
      create: {
        organizationId: orgUplifter.id, planId: platinumPlan.id, status: "ACTIVE", billingCycle: "YEARLY",
        currentPeriodStart: daysAgo(60), currentPeriodEnd: daysFromNow(305),
        stripeCustomerId: "cus_seed_uplifter", stripeSubscriptionId: "sub_seed_uplifter",
      },
    }),
  ]);
  console.log("  ✓ Created subscriptions for all organizations");

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
  
  // Demo Gym and Uplifter users (from original seed.ts)
  const andrewUser = await prisma.user.upsert({
    where: { email: "andrewkarzel@uplifterinc.com" },
    update: { isSuperAdmin: true, organizationId: orgUplifter.id },
    create: { email: "andrewkarzel@uplifterinc.com", name: "Andrew Karzel", passwordHash: hashedPassword, role: "ADMIN", status: "ACTIVE", organizationId: orgUplifter.id, isSuperAdmin: true },
  });
  const demoAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: { organizationId: orgDemo.id },
    create: { email: "admin@demo.com", name: "Admin User", passwordHash: hashedPassword, role: "ADMIN", status: "ACTIVE", organizationId: orgDemo.id },
  });
  const demoCoach = await prisma.user.upsert({
    where: { email: "coach@demo.com" },
    update: { organizationId: orgDemo.id },
    create: { email: "coach@demo.com", name: "Sarah Coach", passwordHash: hashedPassword, role: "COACH", status: "ACTIVE", organizationId: orgDemo.id },
  });
  console.log("  ✓ Created 10 users across all organizations");

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
    // Demo Gym and Uplifter memberships
    { orgId: orgUplifter.id, userId: andrewUser.id, role: "ADMIN" as const },
    { orgId: orgDemo.id, userId: andrewUser.id, role: "ADMIN" as const }, // Andrew has access to Demo too
    { orgId: orgDemo.id, userId: demoAdmin.id, role: "ADMIN" as const },
    { orgId: orgDemo.id, userId: demoCoach.id, role: "COACH" as const },
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
    // Demo Gym and Uplifter permissions
    { userId: andrewUser.id, permission: "*" },
    { userId: demoAdmin.id, permission: "*" },
    { userId: demoCoach.id, permission: "dashboard.view" },
    { userId: demoCoach.id, permission: "athletes.view" },
    { userId: demoCoach.id, permission: "athletes.edit" },
    { userId: demoCoach.id, permission: "training.view" },
    { userId: demoCoach.id, permission: "training.create" },
    { userId: demoCoach.id, permission: "training.edit" },
    { userId: demoCoach.id, permission: "events.view" },
    { userId: demoCoach.id, permission: "events.create" },
    { userId: demoCoach.id, permission: "events.edit" },
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
  // FACILITIES
  // ============================================
  console.log("\n🏢 Creating facilities...");
  const org1Facility1 = await prisma.facility.upsert({
    where: { id: `${ORG1_ID}-facility-main` },
    update: {},
    create: {
      id: `${ORG1_ID}-facility-main`,
      organizationId: ORG1_ID,
      name: "Sunrise Main Gym",
      street: "123 Gymnastics Way",
      city: "Sunnyvale",
      stateProvince: "CA",
      postalCode: "94086",
      country: "USA",
      phone: "(555) 100-1000",
      email: "info@sunrise-gymnastics.com",
      status: "ACTIVE",
      isDefault: true,
      squareFootage: 15000,
      maxCapacity: 200,
      description: "Our main training facility with full apparatus setup",
    },
  });
  const org1Facility2 = await prisma.facility.upsert({
    where: { id: `${ORG1_ID}-facility-satellite` },
    update: {},
    create: {
      id: `${ORG1_ID}-facility-satellite`,
      organizationId: ORG1_ID,
      name: "Sunrise Satellite Studio",
      street: "456 Flip Lane",
      city: "Mountain View",
      stateProvince: "CA",
      postalCode: "94040",
      country: "USA",
      phone: "(555) 100-2000",
      email: "satellite@sunrise-gymnastics.com",
      status: "ACTIVE",
      isDefault: false,
      squareFootage: 5000,
      maxCapacity: 60,
      description: "Smaller studio for preschool and recreational classes",
    },
  });
  const org2Facility = await prisma.facility.upsert({
    where: { id: `${ORG2_ID}-facility-main` },
    update: {},
    create: {
      id: `${ORG2_ID}-facility-main`,
      organizationId: ORG2_ID,
      name: "Metro Sports Complex",
      street: "789 Sports Center Blvd",
      city: "San Jose",
      stateProvince: "CA",
      postalCode: "95110",
      country: "USA",
      phone: "(555) 200-1000",
      email: "info@metro-sports.com",
      status: "ACTIVE",
      isDefault: true,
      squareFootage: 25000,
      maxCapacity: 400,
      description: "Multi-sport community facility with various courts and fields",
    },
  });
  console.log("  ✓ Created 3 facilities");

  // ============================================
  // TRAINING ZONES
  // ============================================
  console.log("\n🏋️ Creating training zones...");
  const trainingZoneData = [
    // Org1 Main Facility
    { id: `${ORG1_ID}-zone-1`, facilityId: org1Facility1.id, name: "Main Floor", type: "Floor", capacity: 50, status: "OPEN" as const },
    { id: `${ORG1_ID}-zone-2`, facilityId: org1Facility1.id, name: "Vault Runway", type: "Vault", capacity: 15, status: "OPEN" as const },
    { id: `${ORG1_ID}-zone-3`, facilityId: org1Facility1.id, name: "Uneven Bars", type: "Bars", capacity: 20, status: "MAINTENANCE" as const },
    { id: `${ORG1_ID}-zone-4`, facilityId: org1Facility1.id, name: "Beam Area", type: "Beam", capacity: 25, status: "OPEN" as const },
    { id: `${ORG1_ID}-zone-5`, facilityId: org1Facility1.id, name: "Tumble Track", type: "Tumble Track", capacity: 10, status: "OPEN" as const },
    // Org1 Satellite Facility
    { id: `${ORG1_ID}-zone-6`, facilityId: org1Facility2.id, name: "Preschool Area", type: "Preschool", capacity: 30, status: "OPEN" as const },
    { id: `${ORG1_ID}-zone-7`, facilityId: org1Facility2.id, name: "Recreational Floor", type: "Floor", capacity: 25, status: "OPEN" as const },
    // Org2 Main Facility
    { id: `${ORG2_ID}-zone-1`, facilityId: org2Facility.id, name: "Basketball Court A", type: "Court", capacity: 30, status: "OPEN" as const },
    { id: `${ORG2_ID}-zone-2`, facilityId: org2Facility.id, name: "Basketball Court B", type: "Court", capacity: 30, status: "OPEN" as const },
    { id: `${ORG2_ID}-zone-3`, facilityId: org2Facility.id, name: "Soccer Field", type: "Field", capacity: 50, status: "OPEN" as const },
    { id: `${ORG2_ID}-zone-4`, facilityId: org2Facility.id, name: "Swimming Pool", type: "Pool", capacity: 40, status: "OPEN" as const },
    { id: `${ORG2_ID}-zone-5`, facilityId: org2Facility.id, name: "Fitness Room", type: "Fitness", capacity: 25, status: "MAINTENANCE" as const },
  ];
  await Promise.all(trainingZoneData.map((z) =>
    prisma.trainingZone.upsert({
      where: { id: z.id },
      update: {},
      create: z,
    })
  ));
  console.log(`  ✓ Created ${trainingZoneData.length} training zones`);

  // ============================================
  // EQUIPMENT
  // ============================================
  console.log("\n🎯 Creating equipment...");
  const equipmentData = [
    // Org1 Main Facility Equipment
    { id: `${ORG1_ID}-equip-1`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-1`, name: "Spring Floor A", type: "Apparatus", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(30) },
    { id: `${ORG1_ID}-equip-2`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-2`, name: "Vault Table (Tac/10)", type: "Apparatus", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(15) },
    { id: `${ORG1_ID}-equip-3`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-3`, name: "Uneven Bars Set 1", type: "Apparatus", condition: "FAIR" as const, status: "MAINTENANCE" as const, lastInspectionDate: daysAgo(60) },
    { id: `${ORG1_ID}-equip-4`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-4`, name: "High Beam 1", type: "Apparatus", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(45) },
    { id: `${ORG1_ID}-equip-5`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-4`, name: "High Beam 2", type: "Apparatus", condition: "POOR" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(90) },
    { id: `${ORG1_ID}-equip-6`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-5`, name: "Tumble Track", type: "Apparatus", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG1_ID}-equip-7`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-2`, name: "Landing Mat (Blue)", type: "Mat", condition: "FAIR" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(40) },
    { id: `${ORG1_ID}-equip-8`, organizationId: ORG1_ID, facilityId: org1Facility1.id, trainingZoneId: `${ORG1_ID}-zone-4`, name: "Low Beam Training", type: "Training Aid", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(25) },
    // Org1 Satellite Equipment
    { id: `${ORG1_ID}-equip-9`, organizationId: ORG1_ID, facilityId: org1Facility2.id, trainingZoneId: `${ORG1_ID}-zone-6`, name: "Preschool Foam Shapes", type: "Training Aid", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(10) },
    { id: `${ORG1_ID}-equip-10`, organizationId: ORG1_ID, facilityId: org1Facility2.id, trainingZoneId: `${ORG1_ID}-zone-7`, name: "Panel Mat Set", type: "Mat", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(35) },
    // Org2 Equipment
    { id: `${ORG2_ID}-equip-1`, organizationId: ORG2_ID, facilityId: org2Facility.id, trainingZoneId: `${ORG2_ID}-zone-1`, name: "Basketball Hoop A", type: "Apparatus", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG2_ID}-equip-2`, organizationId: ORG2_ID, facilityId: org2Facility.id, trainingZoneId: `${ORG2_ID}-zone-2`, name: "Basketball Hoop B", type: "Apparatus", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG2_ID}-equip-3`, organizationId: ORG2_ID, facilityId: org2Facility.id, trainingZoneId: `${ORG2_ID}-zone-3`, name: "Soccer Goals (Pair)", type: "Apparatus", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(7) },
    { id: `${ORG2_ID}-equip-4`, organizationId: ORG2_ID, facilityId: org2Facility.id, trainingZoneId: `${ORG2_ID}-zone-4`, name: "Lane Dividers", type: "Safety Equipment", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(14) },
    { id: `${ORG2_ID}-equip-5`, organizationId: ORG2_ID, facilityId: org2Facility.id, trainingZoneId: `${ORG2_ID}-zone-5`, name: "Treadmills (Set of 5)", type: "Apparatus", condition: "FAIR" as const, status: "MAINTENANCE" as const, lastInspectionDate: daysAgo(60) },
  ];
  await Promise.all(equipmentData.map((e) =>
    prisma.equipment.upsert({
      where: { id: e.id },
      update: {},
      create: e,
    })
  ));
  console.log(`  ✓ Created ${equipmentData.length} equipment items`);

  // ============================================
  // FACILITY ASSIGNMENTS
  // ============================================
  console.log("\n👷 Creating facility assignments...");
  const facilityAssignmentData = [
    { id: `${ORG1_ID}-assign-1`, facilityId: org1Facility1.id, userId: org1Coach1.id, isPrimary: true },
    { id: `${ORG1_ID}-assign-2`, facilityId: org1Facility1.id, userId: org1Coach2.id, isPrimary: true },
    { id: `${ORG1_ID}-assign-3`, facilityId: org1Facility2.id, userId: org1Coach1.id, isPrimary: false },
    { id: `${ORG2_ID}-assign-1`, facilityId: org2Facility.id, userId: org2Coach.id, isPrimary: true },
    { id: `${ORG2_ID}-assign-2`, facilityId: org2Facility.id, userId: org2Volunteer.id, isPrimary: true },
  ];
  await Promise.all(facilityAssignmentData.map((a) =>
    prisma.facilityAssignment.upsert({
      where: { id: a.id },
      update: {},
      create: a,
    })
  ));
  console.log(`  ✓ Created ${facilityAssignmentData.length} facility assignments`);

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
  // SKILLS (Enhanced with difficulty levels and age ranges)
  // ============================================
  console.log("\n🎯 Creating skills...");
  
  // Org1 - Gymnastics skills organized by apparatus and difficulty
  const org1SkillsData = [
    // Floor - Beginner (ages 4-7)
    { id: `${ORG1_ID}-skill-1`, name: "Forward Roll", category: "Floor", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 8, description: "Start standing, tuck chin to chest, push off feet, roll smoothly onto back, and stand up. Key points: tight tuck, hands push floor, smooth momentum." },
    { id: `${ORG1_ID}-skill-2`, name: "Backward Roll", category: "Floor", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 8, description: "From standing, squat down, roll backward keeping chin tucked, push through hands by ears, stand up. Key points: hands by ears, push hard to clear head." },
    { id: `${ORG1_ID}-skill-3`, name: "Cartwheel", category: "Floor", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "Hand-hand-foot-foot pattern with straight legs passing through handstand position. Key points: straight legs, T-position arms, look at hands." },
    { id: `${ORG1_ID}-skill-4`, name: "Handstand", category: "Floor", level: "Silver", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "Kick up to inverted position with body in straight line from wrists to toes. Key points: tight core, shoulder shrug, look at hands." },
    { id: `${ORG1_ID}-skill-5`, name: "Bridge", category: "Floor", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 8, description: "Arched position with hands and feet on floor, stomach facing ceiling. Key points: push shoulders over hands, straight arms." },
    
    // Floor - Intermediate (ages 6-10)
    { id: `${ORG1_ID}-skill-6`, name: "Round-off", category: "Floor", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 6, maxAge: 12, description: "Running entry, cartwheel with 1/4 turn to land with both feet together facing start direction. Key points: fast snap-down, arms by ears." },
    { id: `${ORG1_ID}-skill-7`, name: "Back Walkover", category: "Floor", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 6, maxAge: 12, description: "Standing back arch through bridge, split legs, and stand up one leg at a time. Key points: controlled arch back, split legs." },
    { id: `${ORG1_ID}-skill-8`, name: "Front Walkover", category: "Floor", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 6, maxAge: 12, description: "Standing forward through handstand with split legs, arch over to standing. Key points: strong lunge, split in handstand." },
    
    // Floor - Advanced (ages 8+)
    { id: `${ORG1_ID}-skill-9`, name: "Back Handspring", category: "Floor", level: "Gold", difficultyLevel: "ADVANCED" as const, minAge: 8, maxAge: 18, description: "Jump backward through handstand, snap down to feet. Key points: sit back, big arm swing, tight arch." },
    { id: `${ORG1_ID}-skill-10`, name: "Front Handspring", category: "Floor", level: "Gold", difficultyLevel: "ADVANCED" as const, minAge: 8, maxAge: 18, description: "Running hurdle to handstand with powerful push through shoulders, snap down to feet. Key points: block through shoulders, tight body." },
    
    // Vault - Beginner
    { id: `${ORG1_ID}-skill-11`, name: "Squat On", category: "Vault", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "Run to springboard, jump to squat position on vault, stand, and jump off. Key points: strong punch off board, knees to chest." },
    { id: `${ORG1_ID}-skill-12`, name: "Straddle Over", category: "Vault", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 6, maxAge: 12, description: "Run, punch off board, place hands on vault and straddle legs over, land on feet. Key points: straight arms, push through shoulders." },
    
    // Vault - Intermediate/Advanced
    { id: `${ORG1_ID}-skill-13`, name: "Handspring Vault", category: "Vault", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 8, maxAge: 18, description: "Run, punch off board, front handspring over vault table. Key points: block through shoulders, tight body, stick landing." },
    
    // Bars - Beginner
    { id: `${ORG1_ID}-skill-14`, name: "Pullover", category: "Bars", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "From hang, pull body up and over bar to front support. Key points: pull close to bar, chin tucked, hips to bar." },
    { id: `${ORG1_ID}-skill-15`, name: "Back Hip Circle", category: "Bars", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "From front support, fall backward around bar keeping hips close. Key points: hollow body, hips stay on bar." },
    { id: `${ORG1_ID}-skill-16`, name: "Glide Swing", category: "Bars", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "From hang, extend body forward then pull legs in to swing under bar. Key points: extend legs forward, pike at end." },
    
    // Bars - Intermediate
    { id: `${ORG1_ID}-skill-17`, name: "Cast", category: "Bars", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 6, maxAge: 14, description: "From front support, push hips away from bar while maintaining hollow shape. Key points: push through shoulders, tight hollow body." },
    { id: `${ORG1_ID}-skill-18`, name: "Kip", category: "Bars", level: "Gold", difficultyLevel: "ADVANCED" as const, minAge: 8, maxAge: 18, description: "From glide, bring toes to bar, then slide legs down bar while pulling to front support. Key points: toes to bar, aggressive pull." },
    
    // Beam - Beginner
    { id: `${ORG1_ID}-skill-19`, name: "Beam Walk", category: "Beam", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 8, description: "Walk forward on beam with good posture, arms out for balance. Key points: eyes up, small steps, pointed toes." },
    { id: `${ORG1_ID}-skill-20`, name: "Dip Walk", category: "Beam", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 8, description: "Walk with a plie (dip) on each step. Key points: deep plie, straight supporting leg, pointed toe." },
    { id: `${ORG1_ID}-skill-21`, name: "Relevé Turns", category: "Beam", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "Turn on balls of feet (relevé) with controlled rotation. Key points: high relevé, spot head, arms help balance." },
    { id: `${ORG1_ID}-skill-22`, name: "Scale", category: "Beam", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 10, description: "Stand on one leg, other leg extended behind, torso parallel to beam. Key points: straight legs, square hips, arms extended." },
    
    // Beam - Intermediate
    { id: `${ORG1_ID}-skill-23`, name: "Cartwheel on Beam", category: "Beam", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 7, maxAge: 14, description: "Cartwheel performed on the balance beam with control. Key points: stay in line, control speed, look at hands." },
    { id: `${ORG1_ID}-skill-24`, name: "Handstand on Beam", category: "Beam", level: "Silver", difficultyLevel: "INTERMEDIATE" as const, minAge: 7, maxAge: 14, description: "Controlled handstand on beam with proper alignment. Key points: controlled kick, tight body, balance through shoulders." },
    
    // General/Conditioning - Beginner
    { id: `${ORG1_ID}-skill-25`, name: "Straddle Stretch", category: "General", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 18, description: "Seated straddle position with chest reaching toward floor. Key points: straight legs, pointed toes, flat back." },
    { id: `${ORG1_ID}-skill-26`, name: "Pike Stretch", category: "General", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 4, maxAge: 18, description: "Seated pike position reaching for toes. Key points: straight legs, flexed feet, nose to knees." },
    { id: `${ORG1_ID}-skill-27`, name: "Hollow Body Hold", category: "General", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 18, description: "Lying on back with arms overhead, lift shoulders and legs off ground maintaining curved spine. Key points: lower back pressed to floor, tight core." },
    { id: `${ORG1_ID}-skill-28`, name: "Arch Body Hold", category: "General", level: "Bronze", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 18, description: "Lying face down, lift arms and legs off ground in arched position. Key points: squeeze glutes, lift chest, arms by ears." },
  ];
  
  for (const skill of org1SkillsData) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {},
      create: { ...skill, organizationId: ORG1_ID },
    });
  }
  
  // Org2 - Multi-sport skills
  const org2SkillsData = [
    { id: `${ORG2_ID}-skill-1`, name: "Dribbling", category: "Soccer", level: "Beginner", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 14, description: "Basic ball control while moving. Key points: soft touches, use both feet, keep ball close." },
    { id: `${ORG2_ID}-skill-2`, name: "Passing", category: "Soccer", level: "Beginner", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 14, description: "Accurate short passes with inside of foot. Key points: plant foot beside ball, follow through toward target." },
    { id: `${ORG2_ID}-skill-3`, name: "Layup", category: "Basketball", level: "Beginner", difficultyLevel: "BEGINNER" as const, minAge: 7, maxAge: 18, description: "Basic layup from both sides of the basket. Key points: two-step approach, knee up, soft touch on backboard." },
    { id: `${ORG2_ID}-skill-4`, name: "Freestyle Stroke", category: "Swimming", level: "Beginner", difficultyLevel: "BEGINNER" as const, minAge: 5, maxAge: 18, description: "Proper freestyle technique with rhythmic breathing. Key points: high elbow recovery, bilateral breathing, flutter kick." },
    { id: `${ORG2_ID}-skill-5`, name: "Shooting Form", category: "Basketball", level: "Intermediate", difficultyLevel: "INTERMEDIATE" as const, minAge: 8, maxAge: 18, description: "Proper shooting mechanics from mid-range. Key points: BEEF - Balance, Eyes, Elbow, Follow-through." },
    { id: `${ORG2_ID}-skill-6`, name: "Backstroke", category: "Swimming", level: "Intermediate", difficultyLevel: "INTERMEDIATE" as const, minAge: 6, maxAge: 18, description: "Proper backstroke technique with rotation. Key points: pinky first entry, hip rotation, steady kick." },
  ];
  
  for (const skill of org2SkillsData) {
    await prisma.skill.upsert({
      where: { id: skill.id },
      update: {},
      create: { ...skill, organizationId: ORG2_ID },
    });
  }
  
  console.log(`  ✓ Created ${org1SkillsData.length + org2SkillsData.length} skills`);
  
  // ============================================
  // EVALUATION TEMPLATES
  // ============================================
  console.log("\n📋 Creating evaluation templates...");
  
  const evaluationTemplatesData = [
    // Org1 - Gymnastics evaluation templates
    {
      id: `${ORG1_ID}-template-preschool`,
      name: "Preschool Basics",
      description: "Fundamental skills assessment for preschool-aged gymnasts (ages 4-5). Focus on body awareness, basic movements, and fun!",
      difficultyLevel: "BEGINNER" as const,
      minAge: 4,
      maxAge: 5,
      organizationId: ORG1_ID,
      // New evaluation enhancement fields
      autoSyncEnabled: false,
      autoSyncLevels: [],
      autoSyncCategories: [],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [`${ORG1_ID}-skill-1`, `${ORG1_ID}-skill-3`, `${ORG1_ID}-skill-5`, `${ORG1_ID}-skill-19`, `${ORG1_ID}-skill-25`], // Forward roll, cartwheel, bridge, beam walk, straddle stretch
    },
    {
      id: `${ORG1_ID}-template-rec-level1`,
      name: "Recreational Level 1",
      description: "Entry-level recreational assessment covering basic skills across all apparatus (ages 5-7).",
      difficultyLevel: "BEGINNER" as const,
      minAge: 5,
      maxAge: 7,
      organizationId: ORG1_ID,
      // Pass/Fail scoring with 75% completion requirement
      autoSyncEnabled: false,
      autoSyncLevels: [],
      autoSyncCategories: [],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 75,
      skillIds: [`${ORG1_ID}-skill-1`, `${ORG1_ID}-skill-2`, `${ORG1_ID}-skill-3`, `${ORG1_ID}-skill-11`, `${ORG1_ID}-skill-14`, `${ORG1_ID}-skill-19`, `${ORG1_ID}-skill-20`, `${ORG1_ID}-skill-27`],
    },
    {
      id: `${ORG1_ID}-template-rec-level2`,
      name: "Recreational Level 2",
      description: "Intermediate recreational assessment with more challenging skills (ages 6-9).",
      difficultyLevel: "INTERMEDIATE" as const,
      minAge: 6,
      maxAge: 9,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with pass threshold of 7
      autoSyncEnabled: false,
      autoSyncLevels: [],
      autoSyncCategories: [],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [`${ORG1_ID}-skill-4`, `${ORG1_ID}-skill-6`, `${ORG1_ID}-skill-7`, `${ORG1_ID}-skill-12`, `${ORG1_ID}-skill-15`, `${ORG1_ID}-skill-17`, `${ORG1_ID}-skill-21`, `${ORG1_ID}-skill-22`],
    },
    {
      id: `${ORG1_ID}-template-preteam`,
      name: "Pre-Team Assessment",
      description: "Assessment to determine readiness for competitive team program (ages 7-10). Must demonstrate proficiency in intermediate skills.",
      difficultyLevel: "INTERMEDIATE" as const,
      minAge: 7,
      maxAge: 10,
      organizationId: ORG1_ID,
      // All skills must pass for pre-team readiness
      autoSyncEnabled: false,
      autoSyncLevels: [],
      autoSyncCategories: [],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "ALL" as const,
      completionThreshold: 100,
      skillIds: [`${ORG1_ID}-skill-6`, `${ORG1_ID}-skill-7`, `${ORG1_ID}-skill-8`, `${ORG1_ID}-skill-13`, `${ORG1_ID}-skill-17`, `${ORG1_ID}-skill-18`, `${ORG1_ID}-skill-23`, `${ORG1_ID}-skill-24`],
    },
    {
      id: `${ORG1_ID}-template-jo-level3`,
      name: "JO Level 3 Readiness",
      description: "Assessment for USAG Junior Olympics Level 3 readiness (ages 8-12). Advanced beginner skills required.",
      difficultyLevel: "ADVANCED" as const,
      minAge: 8,
      maxAge: 12,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with strict 8+ threshold and 90% completion
      autoSyncEnabled: false,
      autoSyncLevels: [],
      autoSyncCategories: [],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 8,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 90,
      skillIds: [`${ORG1_ID}-skill-9`, `${ORG1_ID}-skill-10`, `${ORG1_ID}-skill-13`, `${ORG1_ID}-skill-18`, `${ORG1_ID}-skill-23`, `${ORG1_ID}-skill-24`],
    },
    {
      id: `${ORG1_ID}-template-auto-beginner`,
      name: "All Beginner Skills Assessment",
      description: "Auto-synced template that automatically includes all beginner-level skills. Great for comprehensive beginner evaluation.",
      difficultyLevel: "BEGINNER" as const,
      minAge: 5,
      maxAge: 10,
      organizationId: ORG1_ID,
      // Auto-sync enabled - will automatically include all beginner skills
      autoSyncEnabled: true,
      autoSyncLevels: ["BEGINNER"],
      autoSyncCategories: [], // Empty means all categories
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "COUNT" as const,
      completionThreshold: 10, // Must pass at least 10 skills
      skillIds: [], // Will be populated by auto-sync
    },
  ];
  
  for (const template of evaluationTemplatesData) {
    const { skillIds, ...templateData } = template;
    
    await prisma.evaluationTemplate.upsert({
      where: { id: template.id },
      update: {
        // Update with new fields if template already exists
        autoSyncEnabled: templateData.autoSyncEnabled,
        autoSyncLevels: templateData.autoSyncLevels,
        autoSyncCategories: templateData.autoSyncCategories,
        scoringType: templateData.scoringType,
        pointScaleMin: templateData.pointScaleMin,
        pointScaleMax: templateData.pointScaleMax,
        pointScalePassThreshold: templateData.pointScalePassThreshold,
        completionType: templateData.completionType,
        completionThreshold: templateData.completionThreshold,
      },
      create: {
        ...templateData,
        skills: skillIds.length > 0 ? {
          create: skillIds.map((skillId, index) => ({
            skillId,
            order: index,
            isRequired: true,
          })),
        } : undefined,
      },
    });
  }
  
  console.log(`  ✓ Created ${evaluationTemplatesData.length} evaluation templates`);

  // ============================================
  // ACHIEVEMENTS
  // ============================================
  console.log("\n🏆 Creating achievements...");
  
  const achievementsData = [
    {
      id: `${ORG1_ID}-achievement-preschool`,
      templateId: `${ORG1_ID}-template-preschool`,
      name: "Preschool Graduate",
      description: "Successfully completed the Preschool Basics evaluation. Ready for the next level!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-rec-level1`,
      templateId: `${ORG1_ID}-template-rec-level1`,
      name: "Rec Level 1 Champion",
      description: "Mastered all foundational gymnastics skills in Recreational Level 1.",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-rec-level2`,
      templateId: `${ORG1_ID}-template-rec-level2`,
      name: "Rec Level 2 Star",
      description: "Achieved excellence in intermediate recreational gymnastics skills.",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-preteam`,
      templateId: `${ORG1_ID}-template-preteam`,
      name: "Pre-Team Ready",
      description: "Demonstrated readiness for the competitive team program. Outstanding dedication!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
    {
      id: `${ORG1_ID}-achievement-jo-level3`,
      templateId: `${ORG1_ID}-template-jo-level3`,
      name: "JO Level 3 Qualifier",
      description: "Qualified for USAG Junior Olympics Level 3. An impressive achievement!",
      badgeImageUrl: null,
      organizationId: ORG1_ID,
    },
  ];

  for (const achievement of achievementsData) {
    await prisma.achievement.upsert({
      where: { id: achievement.id },
      update: {},
      create: achievement,
    });
  }
  
  console.log(`  ✓ Created ${achievementsData.length} achievements`);

  // ============================================
  // PROGRAM EVALUATION TEMPLATES (Assign templates to programs)
  // ============================================
  console.log("\n🔗 Assigning evaluation templates to programs...");
  
  const programTemplateAssignments = [
    // Bronze program uses Rec Level 1 template
    {
      id: `${ORG1_ID}-pet-bronze-rec1`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      templateId: `${ORG1_ID}-template-rec-level1`,
      isRequired: true,
      dueDate: null,
    },
    // Silver program uses Rec Level 2 template
    {
      id: `${ORG1_ID}-pet-silver-rec2`,
      programId: `${ORG1_ID}-prog-rec-silver`,
      templateId: `${ORG1_ID}-template-rec-level2`,
      isRequired: true,
      dueDate: null,
    },
    // JO Level 3 program uses Pre-Team and JO Level 3 templates
    {
      id: `${ORG1_ID}-pet-jo3-preteam`,
      programId: `${ORG1_ID}-prog-jo-level3`,
      templateId: `${ORG1_ID}-template-preteam`,
      isRequired: false,
      dueDate: null,
    },
    {
      id: `${ORG1_ID}-pet-jo3-jo3`,
      programId: `${ORG1_ID}-prog-jo-level3`,
      templateId: `${ORG1_ID}-template-jo-level3`,
      isRequired: true,
      dueDate: null,
    },
    // Preschool program uses Preschool Basics template
    {
      id: `${ORG1_ID}-pet-preschool`,
      programId: `${ORG1_ID}-prog-preschool`,
      templateId: `${ORG1_ID}-template-preschool`,
      isRequired: true,
      dueDate: null,
    },
  ];

  for (const assignment of programTemplateAssignments) {
    await prisma.programEvaluationTemplate.upsert({
      where: { id: assignment.id },
      update: {},
      create: assignment,
    });
  }
  
  console.log(`  ✓ Created ${programTemplateAssignments.length} program-template assignments`);

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
  // EVALUATIONS (Enhanced with templates and skill attempt statuses)
  // ============================================
  console.log("\n📝 Creating evaluations...");
  
  // Evaluation 1 - Emily (Bronze athlete) - Completed Rec Level 1
  const eval1 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-1` },
    update: { programId: `${ORG1_ID}-prog-rec-bronze` },
    create: {
      id: `${ORG1_ID}-eval-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level1`,
      programId: `${ORG1_ID}-prog-rec-bronze`, // Link to Bronze program
      date: daysAgo(14),
      level: "Recreational Level 1",
      overallScore: 7.5,
      status: "PASS",
      notes: "Emily is making great progress! Strong tumbling skills. Keep working on bar endurance.",
    },
  });
  
  // Skill ratings for eval1 - mix of succeeded, attempted, and not attempted (Pass/Fail scoring)
  const eval1Skills = [
    { skillId: `${ORG1_ID}-skill-1`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Perfect forward roll with smooth momentum" },
    { skillId: `${ORG1_ID}-skill-2`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Good backward roll, chin nicely tucked" },
    { skillId: `${ORG1_ID}-skill-3`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Beautiful cartwheel, straight legs" },
    { skillId: `${ORG1_ID}-skill-11`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Almost there! Needs stronger punch off board" },
    { skillId: `${ORG1_ID}-skill-14`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Working on pulling hips to bar" },
    { skillId: `${ORG1_ID}-skill-19`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Confident beam walking" },
    { skillId: `${ORG1_ID}-skill-20`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Nice deep dips" },
    { skillId: `${ORG1_ID}-skill-27`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Strong hollow hold" },
  ];
  
  for (const skill of eval1Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval1.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval1.id, ...skill },
    });
  }
  
  // Evaluation 2 - Sophie (Silver athlete) - Completed Rec Level 2 (Point Scale scoring)
  const eval2 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-2` },
    update: { programId: `${ORG1_ID}-prog-rec-silver` },
    create: {
      id: `${ORG1_ID}-eval-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level2`,
      programId: `${ORG1_ID}-prog-rec-silver`, // Link to Silver program
      date: daysAgo(21),
      level: "Recreational Level 2",
      overallScore: 8.5,
      status: "EXCELLENT",
      notes: "Sophie is ready for pre-team evaluation! Excellent work ethic and technique.",
    },
  });
  
  // Point scale scoring (1-10, pass threshold 7) for eval2
  const eval2Skills = [
    { skillId: `${ORG1_ID}-skill-4`, attemptStatus: "SUCCEEDED" as const, pointScore: 9, passed: true, comment: "Beautiful handstand form" },
    { skillId: `${ORG1_ID}-skill-6`, attemptStatus: "SUCCEEDED" as const, pointScore: 8, passed: true, comment: "Strong round-off with good snap" },
    { skillId: `${ORG1_ID}-skill-7`, attemptStatus: "SUCCEEDED" as const, pointScore: 9, passed: true, comment: "Controlled back walkover" },
    { skillId: `${ORG1_ID}-skill-12`, attemptStatus: "SUCCEEDED" as const, pointScore: 8, passed: true, comment: "Clean straddle over vault" },
    { skillId: `${ORG1_ID}-skill-15`, attemptStatus: "SUCCEEDED" as const, pointScore: 9, passed: true, comment: "Smooth back hip circle" },
    { skillId: `${ORG1_ID}-skill-17`, attemptStatus: "SUCCEEDED" as const, pointScore: 8, passed: true, comment: "High cast with good form" },
    { skillId: `${ORG1_ID}-skill-21`, attemptStatus: "SUCCEEDED" as const, pointScore: 9, passed: true, comment: "Confident beam turns" },
    { skillId: `${ORG1_ID}-skill-22`, attemptStatus: "ATTEMPTED" as const, pointScore: 6, passed: false, comment: "Working on leg height in scale" },
  ];
  
  for (const skill of eval2Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval2.id, skillId: skill.skillId } },
      update: { passed: skill.passed, pointScore: skill.pointScore },
      create: { evaluationId: eval2.id, ...skill },
    });
  }
  
  // Evaluation 3 - Olivia (JO athlete) - Pre-Team Assessment - PASS
  const eval3 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-3` },
    update: { programId: `${ORG1_ID}-prog-jo-level3` },
    create: {
      id: `${ORG1_ID}-eval-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      coachId: org1Coach2.id,
      templateId: `${ORG1_ID}-template-preteam`,
      programId: `${ORG1_ID}-prog-jo-level3`, // Link to JO Level 3 program
      date: daysAgo(45),
      level: "Pre-Team",
      overallScore: 8.0,
      status: "PASS",
      notes: "Olivia has passed the pre-team assessment and is ready to join the JO team!",
    },
  });
  
  // Pass/Fail scoring for Pre-Team (all skills must pass)
  const eval3Skills = [
    { skillId: `${ORG1_ID}-skill-6`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Excellent round-off" },
    { skillId: `${ORG1_ID}-skill-7`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Good flexibility" },
    { skillId: `${ORG1_ID}-skill-8`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Nice front walkover" },
    { skillId: `${ORG1_ID}-skill-13`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Strong vault" },
    { skillId: `${ORG1_ID}-skill-17`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "High cast" },
    { skillId: `${ORG1_ID}-skill-18`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Almost has the kip - keep practicing!" },
    { skillId: `${ORG1_ID}-skill-23`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Confident beam cartwheel" },
    { skillId: `${ORG1_ID}-skill-24`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Good start on beam handstand" },
  ];
  
  for (const skill of eval3Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval3.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval3.id, ...skill },
    });
  }
  
  // Evaluation 4 - Lily (Bronze athlete) - Pending Rec Level 1
  const eval4 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-4` },
    update: { programId: `${ORG1_ID}-prog-rec-bronze` },
    create: {
      id: `${ORG1_ID}-eval-4`,
      athleteId: `${ORG1_ID}-ath-4`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-rec-level1`,
      programId: `${ORG1_ID}-prog-rec-bronze`, // Link to Bronze program
      date: daysFromNow(7),
      level: "Recreational Level 1",
      overallScore: 0,
      status: "PENDING",
      notes: null,
    },
  });
  
  // Create NOT_ATTEMPTED skill ratings for pending evaluation
  const eval4SkillIds = [`${ORG1_ID}-skill-1`, `${ORG1_ID}-skill-2`, `${ORG1_ID}-skill-3`, `${ORG1_ID}-skill-11`, `${ORG1_ID}-skill-14`, `${ORG1_ID}-skill-19`, `${ORG1_ID}-skill-20`, `${ORG1_ID}-skill-27`];
  for (const skillId of eval4SkillIds) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval4.id, skillId } },
      update: { passed: false },
      create: { evaluationId: eval4.id, skillId, attemptStatus: "NOT_ATTEMPTED", passed: false },
    });
  }
  
  // Evaluation 5 - Hannah (Preschool) - Completed Preschool Basics
  const eval5 = await prisma.evaluation.upsert({
    where: { id: `${ORG1_ID}-eval-5` },
    update: { programId: `${ORG1_ID}-prog-preschool` },
    create: {
      id: `${ORG1_ID}-eval-5`,
      athleteId: `${ORG1_ID}-ath-8`,
      coachId: org1Coach1.id,
      templateId: `${ORG1_ID}-template-preschool`,
      programId: `${ORG1_ID}-prog-preschool`, // Link to Preschool program
      date: daysAgo(7),
      level: "Preschool Basics",
      overallScore: 6.0,
      status: "SATISFACTORY",
      notes: "Hannah is doing great for her age! Very enthusiastic and always trying her best.",
    },
  });
  
  const eval5Skills = [
    { skillId: `${ORG1_ID}-skill-1`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Getting the roll!" },
    { skillId: `${ORG1_ID}-skill-3`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Working on straight legs" },
    { skillId: `${ORG1_ID}-skill-5`, attemptStatus: "ATTEMPTED" as const, passed: false, comment: "Almost pushing up!" },
    { skillId: `${ORG1_ID}-skill-19`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Great balance!" },
    { skillId: `${ORG1_ID}-skill-25`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Good flexibility" },
  ];
  
  for (const skill of eval5Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval5.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval5.id, ...skill },
    });
  }
  
  console.log("  ✓ Created 5 evaluations with skill ratings");

  // ============================================
  // ATHLETE ACHIEVEMENTS (Earned from completed evaluations)
  // ============================================
  console.log("\n🎖️ Creating athlete achievements...");
  
  const athleteAchievementsData = [
    // Emily earned Rec Level 1 Champion
    {
      id: `${ORG1_ID}-athlete-ach-1`,
      athleteId: `${ORG1_ID}-ath-1`,
      achievementId: `${ORG1_ID}-achievement-rec-level1`,
      evaluationId: eval1.id,
      earnedAt: daysAgo(14),
      bestResultsByCategory: { "Floor": 100, "Vault": 50, "Bars": 50, "Beam": 100, "Conditioning": 100 },
      overallScore: 7.5,
    },
    // Sophie earned Rec Level 2 Star
    {
      id: `${ORG1_ID}-athlete-ach-2`,
      athleteId: `${ORG1_ID}-ath-2`,
      achievementId: `${ORG1_ID}-achievement-rec-level2`,
      evaluationId: eval2.id,
      earnedAt: daysAgo(21),
      bestResultsByCategory: { "Floor": 9, "Vault": 8, "Bars": 8.5, "Beam": 8, "Conditioning": 9 },
      overallScore: 8.5,
    },
    // Olivia earned Pre-Team Ready
    {
      id: `${ORG1_ID}-athlete-ach-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      achievementId: `${ORG1_ID}-achievement-preteam`,
      evaluationId: eval3.id,
      earnedAt: daysAgo(45),
      bestResultsByCategory: { "Floor": 100, "Vault": 100, "Bars": 50, "Beam": 75 },
      overallScore: 8.0,
    },
    // Hannah earned Preschool Graduate
    {
      id: `${ORG1_ID}-athlete-ach-4`,
      athleteId: `${ORG1_ID}-ath-8`,
      achievementId: `${ORG1_ID}-achievement-preschool`,
      evaluationId: eval5.id,
      earnedAt: daysAgo(7),
      bestResultsByCategory: { "Floor": 66, "Beam": 100, "Flexibility": 100 },
      overallScore: 6.0,
    },
  ];

  for (const achievement of athleteAchievementsData) {
    await prisma.athleteAchievement.upsert({
      where: { id: achievement.id },
      update: {},
      create: achievement,
    });
  }
  
  console.log(`  ✓ Created ${athleteAchievementsData.length} athlete achievements`);
  
  // ============================================
  // ATHLETE SKILL PROGRESS (Aggregated from evaluations)
  // ============================================
  console.log("\n📊 Creating athlete skill progress records...");
  
  // Emily's skill progress
  const emilyProgress = [
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-1`, bestStatus: "SUCCEEDED" as const, attemptCount: 3, successCount: 2, firstAttemptedAt: daysAgo(60), firstSucceededAt: daysAgo(30), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-2`, bestStatus: "SUCCEEDED" as const, attemptCount: 4, successCount: 2, firstAttemptedAt: daysAgo(55), firstSucceededAt: daysAgo(14), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-3`, bestStatus: "SUCCEEDED" as const, attemptCount: 5, successCount: 3, firstAttemptedAt: daysAgo(50), firstSucceededAt: daysAgo(21), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-11`, bestStatus: "ATTEMPTED" as const, attemptCount: 2, successCount: 0, firstAttemptedAt: daysAgo(28), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-14`, bestStatus: "ATTEMPTED" as const, attemptCount: 3, successCount: 0, firstAttemptedAt: daysAgo(35), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-19`, bestStatus: "SUCCEEDED" as const, attemptCount: 2, successCount: 2, firstAttemptedAt: daysAgo(45), firstSucceededAt: daysAgo(45), lastEvaluatedAt: daysAgo(14) },
    { athleteId: `${ORG1_ID}-ath-1`, skillId: `${ORG1_ID}-skill-27`, bestStatus: "SUCCEEDED" as const, attemptCount: 4, successCount: 3, firstAttemptedAt: daysAgo(40), firstSucceededAt: daysAgo(28), lastEvaluatedAt: daysAgo(14) },
  ];
  
  for (const progress of emilyProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }
  
  // Sophie's skill progress (more advanced)
  const sophieProgress = [
    { athleteId: `${ORG1_ID}-ath-2`, skillId: `${ORG1_ID}-skill-4`, bestStatus: "SUCCEEDED" as const, attemptCount: 5, successCount: 4, firstAttemptedAt: daysAgo(90), firstSucceededAt: daysAgo(60), lastEvaluatedAt: daysAgo(21) },
    { athleteId: `${ORG1_ID}-ath-2`, skillId: `${ORG1_ID}-skill-6`, bestStatus: "SUCCEEDED" as const, attemptCount: 6, successCount: 5, firstAttemptedAt: daysAgo(80), firstSucceededAt: daysAgo(45), lastEvaluatedAt: daysAgo(21) },
    { athleteId: `${ORG1_ID}-ath-2`, skillId: `${ORG1_ID}-skill-7`, bestStatus: "SUCCEEDED" as const, attemptCount: 4, successCount: 3, firstAttemptedAt: daysAgo(70), firstSucceededAt: daysAgo(35), lastEvaluatedAt: daysAgo(21) },
    { athleteId: `${ORG1_ID}-ath-2`, skillId: `${ORG1_ID}-skill-22`, bestStatus: "ATTEMPTED" as const, attemptCount: 3, successCount: 0, firstAttemptedAt: daysAgo(40), lastEvaluatedAt: daysAgo(21) },
  ];
  
  for (const progress of sophieProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }
  
  console.log(`  ✓ Created ${emilyProgress.length + sophieProgress.length} athlete skill progress records`);

  // ============================================
  // ANNOUNCEMENTS (Organization-level)
  // ============================================
  console.log("\n📢 Creating announcements...");
  const announcementData = [
    { id: `${ORG1_ID}-ann-1`, title: "Spring Competition Registration Open", content: "<p>Registration for our <strong>Annual Spring Invitational</strong> is now open!</p><p>Don't miss out - spots fill up fast.</p>", targetScope: "ALL" as const, priority: "HIGH" as const, status: "PUBLISHED" as const, publishedAt: daysAgo(3), organizationId: ORG1_ID },
    { id: `${ORG1_ID}-ann-2`, title: "JO Team Meeting", content: "<p>Mandatory parent meeting for all <strong>JO team families</strong>.</p><ul><li>Date: This Saturday</li><li>Time: 10:00 AM</li><li>Location: Main Gym</li></ul>", targetScope: "PROGRAM" as const, priority: "NORMAL" as const, targetProgramId: `${ORG1_ID}-prog-jo`, status: "PUBLISHED" as const, publishedAt: daysAgo(1), organizationId: ORG1_ID },
    { id: `${ORG1_ID}-ann-3`, title: "Gym Closure Notice", content: "<p><strong>IMPORTANT:</strong> The gym will be closed next Monday for maintenance.</p>", targetScope: "ALL" as const, priority: "URGENT" as const, status: "PUBLISHED" as const, publishedAt: daysAgo(0), organizationId: ORG1_ID },
    { id: `${ORG2_ID}-ann-1`, title: "Swim Meet Carpool", content: "<p>We're organizing carpools for the upcoming swim meet.</p><p>Please sign up at the front desk if interested.</p>", targetScope: "PROGRAM" as const, priority: "NORMAL" as const, targetProgramId: `${ORG2_ID}-prog-swim`, status: "PUBLISHED" as const, publishedAt: daysAgo(2), organizationId: ORG2_ID },
    { id: `${ORG2_ID}-ann-2`, title: "Summer Camp Early Bird Registration", content: "<p>Summer camp registration opens next week!</p><p><em>Early bird discounts available through March 15th.</em></p>", targetScope: "ALL" as const, priority: "LOW" as const, status: "PUBLISHED" as const, publishedAt: daysAgo(5), organizationId: ORG2_ID },
  ];
  for (const ann of announcementData) {
    await prisma.announcement.upsert({ where: { id: ann.id }, update: {}, create: ann });
  }
  console.log(`  ✓ Created ${announcementData.length} organization announcements`);

  // ============================================
  // SYSTEM ANNOUNCEMENTS (Superadmin platform-wide)
  // ============================================
  console.log("\n🌐 Creating system announcements...");
  const systemAnnouncementData = [
    { 
      id: "sys-ann-1", 
      title: "Welcome to Uplifter!", 
      content: "<p>Welcome to the <strong>Uplifter</strong> platform! We're excited to have you.</p><p>Check out these resources to get started:</p><ul><li>Documentation &amp; guides</li><li>Video tutorials</li><li>Support team availability</li></ul>", 
      priority: "NORMAL" as const, 
      status: "PUBLISHED" as const, 
      publishedAt: daysAgo(14), 
      createdById: andrewUser.id 
    },
    { 
      id: "sys-ann-2", 
      title: "New Feature: SMS Messaging", 
      content: "<p>We've launched <strong>SMS messaging</strong> capabilities!</p><p>You can now send text messages to athletes and families directly from the platform. Check out the Communication section to get started.</p>", 
      priority: "HIGH" as const, 
      status: "PUBLISHED" as const, 
      publishedAt: daysAgo(7), 
      createdById: andrewUser.id 
    },
    { 
      id: "sys-ann-3", 
      title: "Scheduled Maintenance - Feb 15", 
      content: "<p><strong>Scheduled Maintenance Notice</strong></p><p>We will be performing system maintenance on <strong>February 15th from 2:00 AM - 4:00 AM EST</strong>.</p><p>During this time, the platform may be temporarily unavailable. We apologize for any inconvenience.</p>", 
      priority: "URGENT" as const, 
      status: "PUBLISHED" as const, 
      publishedAt: daysAgo(2), 
      expiresAt: daysFromNow(30),
      createdById: andrewUser.id 
    },
    { 
      id: "sys-ann-4", 
      title: "Tips for Maximizing Your Experience", 
      content: "<p>Here are some tips to get the most out of Uplifter:</p><ol><li>Set up your organization branding</li><li>Configure your programs and pricing</li><li>Invite your staff members</li><li>Start enrolling athletes!</li></ol>", 
      priority: "LOW" as const, 
      status: "PUBLISHED" as const, 
      publishedAt: daysAgo(10), 
      createdById: andrewUser.id 
    },
    { 
      id: "sys-ann-5", 
      title: "Draft: Upcoming Feature Preview", 
      content: "<p>This is a draft announcement about an upcoming feature...</p>", 
      priority: "NORMAL" as const, 
      status: "DRAFT" as const, 
      createdById: andrewUser.id 
    },
  ];
  for (const ann of systemAnnouncementData) {
    await prisma.systemAnnouncement.upsert({ where: { id: ann.id }, update: {}, create: ann });
  }
  console.log(`  ✓ Created ${systemAnnouncementData.length} system announcements`);

  // ============================================
  // WEBSITE CONFIGS
  // ============================================
  console.log("\n🌐 Creating website configurations...");
  
  // Default info box content
  const defaultInfoBox1Title = "Membership Includes";
  const defaultInfoBox1Content = "<ul><li>Access to all registered programs</li><li>Facility and equipment access</li><li>Member communications and updates</li><li>Participation in club events</li></ul>";
  const defaultInfoBox2Title = "Financial Assistance";
  const defaultInfoBox2Content = "<p>We believe in accessible athletics for all. Financial assistance may be available for qualifying families. Contact us for more information about assistance options.</p>";
  const defaultInfoBox3Title = "Get Involved";
  const defaultInfoBox3Content = "<p>We run on community support. Volunteer opportunities are available for parents and members who want to contribute to our programs and events.</p>";

  // Create configs for all organizations
  await Promise.all([
    prisma.websiteConfig.upsert({
      where: { organizationId: ORG1_ID }, update: {},
      create: { organizationId: ORG1_ID, subdomain: "sunrise-gymnastics", primaryColor: "#FF6B35", secondaryColor: "#004E89", heroHeadline: "Where Champions Begin", heroSubheadline: "Building confidence through gymnastics", heroAgeRange: "Ages 3-18", heroProgramPeriods: "Year-Round Programs", heroLocation: "Sunnyvale, CA", showCalendar: true, showRegistration: true, showContact: true, isPublished: true, infoBox1Title: defaultInfoBox1Title, infoBox1Content: defaultInfoBox1Content, infoBox2Title: defaultInfoBox2Title, infoBox2Content: defaultInfoBox2Content, infoBox3Title: defaultInfoBox3Title, infoBox3Content: defaultInfoBox3Content },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: ORG2_ID }, update: {},
      create: { organizationId: ORG2_ID, subdomain: "metro-sports", primaryColor: "#2D5A27", secondaryColor: "#F5A623", heroHeadline: "Play. Compete. Thrive.", heroSubheadline: "Your community sports destination", heroAgeRange: "All Ages Welcome", heroProgramPeriods: "Seasonal Programs", heroLocation: "San Jose, CA", showCalendar: true, showRegistration: true, showContact: true, isPublished: true, infoBox1Title: defaultInfoBox1Title, infoBox1Content: defaultInfoBox1Content, infoBox2Title: defaultInfoBox2Title, infoBox2Content: defaultInfoBox2Content, infoBox3Title: defaultInfoBox3Title, infoBox3Content: defaultInfoBox3Content },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: orgDemo.id }, update: {},
      create: { organizationId: orgDemo.id, subdomain: "demo-gym", primaryColor: "#3B82F6", secondaryColor: "#10B981", heroHeadline: "Welcome to Demo Gym", heroSubheadline: "Your gymnastics journey starts here", heroAgeRange: "All Ages Welcome", heroProgramPeriods: "Year-Round Programs", heroLocation: "Anytown, USA", showCalendar: true, showRegistration: true, showContact: true, isPublished: true, infoBox1Title: defaultInfoBox1Title, infoBox1Content: defaultInfoBox1Content, infoBox2Title: defaultInfoBox2Title, infoBox2Content: defaultInfoBox2Content, infoBox3Title: defaultInfoBox3Title, infoBox3Content: defaultInfoBox3Content },
    }),
    prisma.websiteConfig.upsert({
      where: { organizationId: orgUplifter.id }, update: {},
      create: { organizationId: orgUplifter.id, subdomain: "uplifter", primaryColor: "#8B5CF6", secondaryColor: "#EC4899", heroHeadline: "Uplifter Platform", heroSubheadline: "Empowering sports organizations", showCalendar: true, showRegistration: true, showContact: true, isPublished: true, infoBox1Title: defaultInfoBox1Title, infoBox1Content: defaultInfoBox1Content, infoBox2Title: defaultInfoBox2Title, infoBox2Content: defaultInfoBox2Content, infoBox3Title: defaultInfoBox3Title, infoBox3Content: defaultInfoBox3Content },
    }),
  ]);
  
  console.log("  ✓ Created 4 website configurations");

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
  
  // Public features on the roadmap
  const feature1 = await prisma.featureRequest.upsert({
    where: { id: "feature-1" }, update: {},
    create: { 
      id: "feature-1", 
      title: "Mobile app for parents", 
      description: "A dedicated mobile app where parents can check schedules, receive notifications, make payments, and track their child's progress. Features would include push notifications, calendar sync, and payment history.", 
      status: "IN_PROGRESS",
      isPublic: true,
      categories: ["Mobile", "Communication"],
      targetDate: daysFromNow(60), // Q1 2026
      statusChangedAt: daysAgo(14),
      userId: org1Admin.id,
    },
  });
  
  const feature2 = await prisma.featureRequest.upsert({
    where: { id: "feature-2" }, update: {},
    create: { 
      id: "feature-2", 
      title: "Automated attendance tracking", 
      description: "QR code or RFID-based check-in system that automatically records attendance when athletes enter the facility. Would integrate with existing scheduling system.", 
      status: "PLANNED",
      isPublic: true,
      categories: ["Athletes", "Scheduling"],
      targetDate: daysFromNow(120), // Q2 2026
      statusChangedAt: daysAgo(7),
      userId: org2Admin.id,
    },
  });
  
  const feature3 = await prisma.featureRequest.upsert({
    where: { id: "feature-3" }, update: {},
    create: { 
      id: "feature-3", 
      title: "Dark mode support", 
      description: "Add a dark mode theme option across all dashboards and portals for better visibility in low-light environments and reduced eye strain.", 
      status: "DONE",
      isPublic: true,
      categories: ["UI/UX"],
      targetDate: daysAgo(30),
      statusChangedAt: daysAgo(5),
      userId: org1Coach1.id,
    },
  });
  
  const feature4 = await prisma.featureRequest.upsert({
    where: { id: "feature-4" }, update: {},
    create: { 
      id: "feature-4", 
      title: "Integration with Stripe for payments", 
      description: "Add Stripe as an alternative payment processor alongside Adyen for organizations that prefer Stripe.", 
      status: "PLANNED",
      isPublic: true,
      categories: ["Integrations", "Financials"],
      targetDate: daysFromNow(180), // Q3 2026
      statusChangedAt: daysAgo(21),
      userId: org2Admin.id,
    },
  });
  
  const feature5 = await prisma.featureRequest.upsert({
    where: { id: "feature-5" }, update: {},
    create: { 
      id: "feature-5", 
      title: "Advanced analytics dashboard", 
      description: "Comprehensive analytics with custom date ranges, exportable reports, athlete progress tracking over time, and financial trend analysis.", 
      status: "IN_PROGRESS",
      isPublic: true,
      categories: ["Analytics", "UI/UX"],
      targetDate: daysFromNow(45),
      statusChangedAt: daysAgo(10),
      userId: org1Admin.id,
    },
  });
  
  // Pending submission (not public)
  const feature6 = await prisma.featureRequest.upsert({
    where: { id: "feature-6" }, update: {},
    create: { 
      id: "feature-6", 
      title: "Bulk athlete import from CSV", 
      description: "Allow administrators to import multiple athletes at once using a CSV file upload. Would save significant time during initial setup or new season registration.", 
      status: "SUBMITTED",
      isPublic: false,
      categories: ["Athletes"],
      userId: org1Coach1.id,
    },
  });
  
  // Feature votes
  const voteData = [
    { id: "vote-1-1", featureRequestId: feature1.id, userId: org1Admin.id },
    { id: "vote-1-2", featureRequestId: feature1.id, userId: org1Coach1.id },
    { id: "vote-1-3", featureRequestId: feature1.id, userId: org2Admin.id },
    { id: "vote-2-1", featureRequestId: feature2.id, userId: org1Admin.id },
    { id: "vote-2-2", featureRequestId: feature2.id, userId: org2Admin.id },
    { id: "vote-3-1", featureRequestId: feature3.id, userId: org1Coach1.id },
    { id: "vote-4-1", featureRequestId: feature4.id, userId: org1Admin.id },
    { id: "vote-4-2", featureRequestId: feature4.id, userId: org2Admin.id },
    { id: "vote-4-3", featureRequestId: feature4.id, userId: org1Coach1.id },
    { id: "vote-5-1", featureRequestId: feature5.id, userId: org1Admin.id },
    { id: "vote-5-2", featureRequestId: feature5.id, userId: org2Admin.id },
  ];
  for (const vote of voteData) {
    await prisma.featureVote.upsert({ where: { id: vote.id }, update: {}, create: vote });
  }
  
  // Feature comments
  await prisma.featureComment.upsert({
    where: { id: "fc-1" }, update: {},
    create: { id: "fc-1", featureRequestId: feature1.id, content: "This would be amazing! Parents constantly ask about a mobile app.", userId: org1Coach1.id, isStaffReply: false },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-2" }, update: {},
    create: { id: "fc-2", featureRequestId: feature1.id, content: "We're actively working on this! Beta testing should begin next month.", userId: andrewUser.id, isStaffReply: true },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-3" }, update: {},
    create: { id: "fc-3", featureRequestId: feature2.id, content: "QR codes would be perfect for our setup. Looking forward to this!", userId: org1Admin.id, isStaffReply: false },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-4" }, update: {},
    create: { id: "fc-4", featureRequestId: feature3.id, content: "Dark mode is now live! Enjoy the new theme options.", userId: andrewUser.id, isStaffReply: true },
  });
  await prisma.featureComment.upsert({
    where: { id: "fc-5" }, update: {},
    create: { id: "fc-5", featureRequestId: feature5.id, content: "Can you add export to PDF for reports?", userId: org2Admin.id, isStaffReply: false },
  });
  
  console.log("  ✓ Created 6 feature requests, 11 votes, and 5 comments");

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
  // STAFF PROFILES
  // ============================================
  console.log("\n👷 Creating staff profiles...");
  const staffProfileData = [
    // Org1 Staff Profiles
    {
      id: `${ORG1_ID}-staff-1`,
      userId: org1Coach1.id,
      organizationId: ORG1_ID,
      employmentType: "FULL_TIME" as const,
      title: "Head Coach",
      hourlyRate: 35.00,
      hireDate: daysAgo(365),
      certifications: [
        { name: "USAG Safety Certification", expiresAt: daysFromNow(180).toISOString(), verified: true },
        { name: "CPR / First Aid", expiresAt: daysFromNow(365).toISOString(), verified: true },
        { name: "SafeSport Trained", expiresAt: daysFromNow(730).toISOString(), verified: true },
      ],
      phone: "(555) 111-2222",
      emergencyContact: { name: "John Rodriguez", phone: "(555) 111-3333", relationship: "Spouse" },
    },
    {
      id: `${ORG1_ID}-staff-2`,
      userId: org1Coach2.id,
      organizationId: ORG1_ID,
      employmentType: "FULL_TIME" as const,
      title: "JO Team Coach",
      hourlyRate: 32.00,
      hireDate: daysAgo(180),
      certifications: [
        { name: "USAG Safety Certification", expiresAt: daysFromNow(300).toISOString(), verified: true },
        { name: "SafeSport Trained", expiresAt: daysFromNow(500).toISOString(), verified: true },
      ],
      phone: "(555) 111-4444",
      emergencyContact: { name: "Lisa Chen", phone: "(555) 111-5555", relationship: "Parent" },
    },
    {
      id: `${ORG1_ID}-staff-3`,
      userId: org1Accountant.id,
      organizationId: ORG1_ID,
      employmentType: "PART_TIME" as const,
      title: "Finance & Admin",
      hourlyRate: 25.00,
      hireDate: daysAgo(90),
      certifications: [
        { name: "Background Check Cleared", expiresAt: null, verified: true },
      ],
      phone: "(555) 111-6666",
      emergencyContact: Prisma.DbNull,
    },
    // Org2 Staff Profiles
    {
      id: `${ORG2_ID}-staff-1`,
      userId: org2Coach.id,
      organizationId: ORG2_ID,
      employmentType: "FULL_TIME" as const,
      title: "Multi-Sport Coach",
      hourlyRate: 28.00,
      hireDate: daysAgo(200),
      certifications: [
        { name: "CPR / First Aid", expiresAt: daysFromNow(200).toISOString(), verified: true },
        { name: "SafeSport Trained", expiresAt: daysFromNow(400).toISOString(), verified: true },
      ],
      phone: "(555) 222-1111",
      emergencyContact: { name: "Carlos Martinez", phone: "(555) 222-2222", relationship: "Spouse" },
    },
    {
      id: `${ORG2_ID}-staff-2`,
      userId: org2Volunteer.id,
      organizationId: ORG2_ID,
      employmentType: "VOLUNTEER" as const,
      title: "Assistant Coach",
      hourlyRate: null,
      hireDate: daysAgo(60),
      certifications: [
        { name: "Background Check Cleared", expiresAt: null, verified: true },
      ],
      phone: "(555) 222-3333",
      emergencyContact: Prisma.DbNull,
    },
  ];
  for (const sp of staffProfileData) {
    await prisma.staffProfile.upsert({ where: { id: sp.id }, update: {}, create: sp });
  }
  console.log(`  ✓ Created ${staffProfileData.length} staff profiles`);

  // ============================================
  // STAFF AVAILABILITY
  // ============================================
  console.log("\n📅 Creating staff availability...");
  const availabilityData = [
    // Org1 Coach 1 - Available weekdays 8am-6pm
    { staffProfileId: `${ORG1_ID}-staff-1`, dayOfWeek: 1, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-1`, dayOfWeek: 2, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-1`, dayOfWeek: 3, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-1`, dayOfWeek: 4, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-1`, dayOfWeek: 5, startTime: "08:00", endTime: "18:00", isAvailable: true },
    // Org1 Coach 2 - Afternoons and evenings
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 1, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 2, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 3, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 4, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 5, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { staffProfileId: `${ORG1_ID}-staff-2`, dayOfWeek: 6, startTime: "09:00", endTime: "14:00", isAvailable: true },
    // Org2 Coach - Full availability
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { staffProfileId: `${ORG2_ID}-staff-1`, dayOfWeek: 6, startTime: "10:00", endTime: "15:00", isAvailable: true },
  ];
  for (const avail of availabilityData) {
    await prisma.staffAvailability.upsert({
      where: { staffProfileId_dayOfWeek: { staffProfileId: avail.staffProfileId, dayOfWeek: avail.dayOfWeek } },
      update: {},
      create: avail,
    });
  }
  console.log(`  ✓ Created ${availabilityData.length} availability entries`);

  // ============================================
  // SHIFTS
  // ============================================
  console.log("\n⏰ Creating shifts...");
  const shiftData = [
    // Today and upcoming shifts for Org1
    { id: `${ORG1_ID}-shift-1`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: today, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "IN_PROGRESS" as const },
    { id: `${ORG1_ID}-shift-2`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: today, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-3`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: daysFromNow(1), startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-4`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: daysFromNow(1), startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-5`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-3`, facilityId: org1Facility1.id, date: daysFromNow(2), startTime: "09:00", endTime: "14:00", shiftType: "Front Desk", status: "SCHEDULED" as const },
    // Historical shifts (completed)
    { id: `${ORG1_ID}-shift-6`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: daysAgo(1), startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "COMPLETED" as const },
    { id: `${ORG1_ID}-shift-7`, organizationId: ORG1_ID, staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: daysAgo(1), startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "COMPLETED" as const },
    // Org2 shifts
    { id: `${ORG2_ID}-shift-1`, organizationId: ORG2_ID, staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id, date: today, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", status: "IN_PROGRESS" as const },
    { id: `${ORG2_ID}-shift-2`, organizationId: ORG2_ID, staffProfileId: `${ORG2_ID}-staff-2`, facilityId: org2Facility.id, date: today, startTime: "14:00", endTime: "18:00", shiftType: "Assistant Coach", status: "SCHEDULED" as const },
    { id: `${ORG2_ID}-shift-3`, organizationId: ORG2_ID, staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id, date: daysFromNow(1), startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", status: "SCHEDULED" as const },
  ];
  for (const shift of shiftData) {
    await prisma.shift.upsert({ where: { id: shift.id }, update: {}, create: shift });
  }
  console.log(`  ✓ Created ${shiftData.length} shifts`);

  // ============================================
  // SCHEDULE TEMPLATES
  // ============================================
  console.log("\n📋 Creating schedule templates...");
  const template1 = await prisma.scheduleTemplate.upsert({
    where: { id: `${ORG1_ID}-template-1` },
    update: {},
    create: { id: `${ORG1_ID}-template-1`, organizationId: ORG1_ID, name: "Standard Week", isActive: true },
  });
  const template2 = await prisma.scheduleTemplate.upsert({
    where: { id: `${ORG2_ID}-template-1` },
    update: {},
    create: { id: `${ORG2_ID}-template-1`, organizationId: ORG2_ID, name: "Regular Schedule", isActive: true },
  });

  // Template entries
  const templateEntryData = [
    // Org1 Standard Week - Mon-Fri
    { id: `${ORG1_ID}-tentry-1`, templateId: template1.id, dayOfWeek: 1, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-2`, templateId: template1.id, dayOfWeek: 1, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-3`, templateId: template1.id, dayOfWeek: 2, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-4`, templateId: template1.id, dayOfWeek: 2, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-5`, templateId: template1.id, dayOfWeek: 3, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", staffProfileId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-6`, templateId: template1.id, dayOfWeek: 3, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", staffProfileId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    // Org2 Regular Schedule
    { id: `${ORG2_ID}-tentry-1`, templateId: template2.id, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-2`, templateId: template2.id, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-3`, templateId: template2.id, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-4`, templateId: template2.id, dayOfWeek: 4, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-5`, templateId: template2.id, dayOfWeek: 5, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", staffProfileId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
  ];
  for (const entry of templateEntryData) {
    await prisma.scheduleTemplateEntry.upsert({ where: { id: entry.id }, update: {}, create: entry });
  }
  console.log(`  ✓ Created 2 schedule templates with ${templateEntryData.length} entries`);

  // ============================================
  // EVENT STAFF ASSIGNMENTS
  // ============================================
  console.log("\n👥 Creating event staff assignments...");
  const eventStaffData = [
    // Org1 Event Staff
    { id: `${ORG1_ID}-es-1`, eventId: `${ORG1_ID}-evt-1`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: "Lead instructor" },
    { id: `${ORG1_ID}-es-2`, eventId: `${ORG1_ID}-evt-2`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG1_ID}-es-3`, eventId: `${ORG1_ID}-evt-3`, staffProfileId: `${ORG1_ID}-staff-2`, role: "LEAD" as const, notes: "JO Team practice lead" },
    { id: `${ORG1_ID}-es-4`, eventId: `${ORG1_ID}-evt-3`, staffProfileId: `${ORG1_ID}-staff-1`, role: "ASSISTANT" as const, notes: "Beam specialist" },
    { id: `${ORG1_ID}-es-5`, eventId: `${ORG1_ID}-evt-4`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: "Competition director" },
    { id: `${ORG1_ID}-es-6`, eventId: `${ORG1_ID}-evt-4`, staffProfileId: `${ORG1_ID}-staff-2`, role: "ASSISTANT" as const, notes: null },
    // Org2 Event Staff
    { id: `${ORG2_ID}-es-1`, eventId: `${ORG2_ID}-evt-1`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG2_ID}-es-2`, eventId: `${ORG2_ID}-evt-1`, staffProfileId: `${ORG2_ID}-staff-2`, role: "VOLUNTEER" as const, notes: "Equipment setup" },
    { id: `${ORG2_ID}-es-3`, eventId: `${ORG2_ID}-evt-2`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG2_ID}-es-4`, eventId: `${ORG2_ID}-evt-3`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: "Meet coordinator" },
  ];
  for (const es of eventStaffData) {
    await prisma.eventStaff.upsert({ 
      where: { id: es.id }, 
      update: {}, 
      create: es 
    });
  }
  console.log(`  ✓ Created ${eventStaffData.length} event staff assignments`);

  // ============================================
  // PROGRAM STAFF ASSIGNMENTS
  // ============================================
  console.log("\n🏅 Creating program staff assignments...");
  const programStaffData = [
    // Org1 Program Staff
    { id: `${ORG1_ID}-ps-1`, programId: `${ORG1_ID}-prog-rec-bronze`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Primary coach for Bronze program" },
    { id: `${ORG1_ID}-ps-2`, programId: `${ORG1_ID}-prog-rec-silver`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    { id: `${ORG1_ID}-ps-3`, programId: `${ORG1_ID}-prog-rec-gold`, staffProfileId: `${ORG1_ID}-staff-1`, role: "ASSISTANT_COACH" as const, isPrimary: false, notes: null },
    { id: `${ORG1_ID}-ps-4`, programId: `${ORG1_ID}-prog-rec-gold`, staffProfileId: `${ORG1_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Primary coach for Gold program" },
    { id: `${ORG1_ID}-ps-5`, programId: `${ORG1_ID}-prog-jo`, staffProfileId: `${ORG1_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "JO Team Head Coach" },
    { id: `${ORG1_ID}-ps-6`, programId: `${ORG1_ID}-prog-jo`, staffProfileId: `${ORG1_ID}-staff-1`, role: "ASSISTANT_COACH" as const, isPrimary: false, notes: "Beam and floor specialist" },
    { id: `${ORG1_ID}-ps-7`, programId: `${ORG1_ID}-prog-preschool`, staffProfileId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    // Org2 Program Staff
    { id: `${ORG2_ID}-ps-1`, programId: `${ORG2_ID}-prog-soccer`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Soccer program lead" },
    { id: `${ORG2_ID}-ps-2`, programId: `${ORG2_ID}-prog-soccer`, staffProfileId: `${ORG2_ID}-staff-2`, role: "VOLUNTEER" as const, isPrimary: false, notes: "Volunteer assistant" },
    { id: `${ORG2_ID}-ps-3`, programId: `${ORG2_ID}-prog-basketball`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    { id: `${ORG2_ID}-ps-4`, programId: `${ORG2_ID}-prog-swim`, staffProfileId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Swim team head coach" },
    { id: `${ORG2_ID}-ps-5`, programId: `${ORG2_ID}-prog-fitness`, staffProfileId: `${ORG2_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Kids fitness leader" },
  ];
  for (const ps of programStaffData) {
    await prisma.programStaff.upsert({
      where: { id: ps.id },
      update: {},
      create: ps,
    });
  }
  console.log(`  ✓ Created ${programStaffData.length} program staff assignments`);

  // ============================================
  // PROGRAM REQUIREMENTS (Membership Requirements)
  // ============================================
  console.log("\n📋 Setting program membership requirements...");
  // JO Team requires the annual club membership
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-jo` },
    data: {
      requiredMemberships: {
        connect: [{ id: `${ORG1_ID}-mi-2026` }],
      },
    },
  });
  // Gold program requires annual club membership
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-rec-gold` },
    data: {
      requiredMemberships: {
        connect: [{ id: `${ORG1_ID}-mi-2026` }],
      },
    },
  });
  // Org2 swim team requires seasonal pass
  await prisma.program.update({
    where: { id: `${ORG2_ID}-prog-swim` },
    data: {
      requiredMemberships: {
        connect: [{ id: `${ORG2_ID}-mi-winter26` }],
      },
    },
  });
  console.log("  ✓ Set membership requirements for 3 programs");

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
  // MEDICAL INFORMATION
  // ============================================
  console.log("\n💊 Creating medical form configurations...");
  
  // Medical Form Config for each organization
  await Promise.all([
    prisma.medicalFormConfig.upsert({
      where: { organizationId: ORG1_ID },
      update: {},
      create: {
        organizationId: ORG1_ID,
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: true,
        collectInsuranceInfo: false,
        requireDuringRegistration: true,
      },
    }),
    prisma.medicalFormConfig.upsert({
      where: { organizationId: ORG2_ID },
      update: {},
      create: {
        organizationId: ORG2_ID,
        collectAllergies: true,
        collectMedications: true,
        collectConditions: true,
        collectEmergencyContact: true,
        collectDietaryRestrictions: false,
        collectInsuranceInfo: true,
        requireDuringRegistration: false,
      },
    }),
  ]);

  console.log("  ✓ Created medical form configs for both organizations");

  // Custom Medical Questions
  console.log("📝 Creating custom medical questions...");
  await Promise.all([
    // Sunrise Gymnastics custom questions
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-1` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-1`,
        organizationId: ORG1_ID,
        questionText: "Has your child had any recent injuries that may affect their training?",
        questionType: "YES_NO",
        required: true,
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-2` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-2`,
        organizationId: ORG1_ID,
        questionText: "What is your child's experience level with gymnastics?",
        questionType: "MULTIPLE_CHOICE",
        options: ["Beginner - No experience", "Intermediate - Some classes", "Advanced - Competitive experience"],
        required: false,
        displayOrder: 2,
        isActive: true,
      },
    }),
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG1_ID}-mq-3` },
      update: {},
      create: {
        id: `${ORG1_ID}-mq-3`,
        organizationId: ORG1_ID,
        questionText: "Are there any specific fears or concerns we should be aware of?",
        questionType: "TEXT",
        required: false,
        displayOrder: 3,
        isActive: true,
      },
    }),
    // Metro Sports custom questions
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG2_ID}-mq-1` },
      update: {},
      create: {
        id: `${ORG2_ID}-mq-1`,
        organizationId: ORG2_ID,
        questionText: "Does your child require an EpiPen?",
        questionType: "YES_NO",
        required: true,
        displayOrder: 1,
        isActive: true,
      },
    }),
    prisma.customMedicalQuestion.upsert({
      where: { id: `${ORG2_ID}-mq-2` },
      update: {},
      create: {
        id: `${ORG2_ID}-mq-2`,
        organizationId: ORG2_ID,
        questionText: "Which sports has your child participated in previously?",
        questionType: "CHECKBOX",
        options: ["Soccer", "Basketball", "Swimming", "Gymnastics", "Track & Field", "None"],
        required: false,
        displayOrder: 2,
        isActive: true,
      },
    }),
  ]);

  console.log("  ✓ Created 5 custom medical questions");

  // Athlete Medical Info
  console.log("🏥 Creating athlete medical info...");
  const medicalInfoRecords = await Promise.all([
    // Emily Anderson - has allergies
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-1` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-1`,
        allergies: ["Peanuts", "Tree Nuts"],
        medications: [],
        conditions: [],
        dietaryRestrictions: ["Nut-Free"],
        emergencyContactName: "Michelle Anderson",
        emergencyContactPhone: "(555) 101-1001",
        emergencyContactRelation: "Mother",
        additionalNotes: "Carries EpiPen in her bag at all times.",
      },
    }),
    // Sophie Anderson - asthma
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-2` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-2`,
        allergies: [],
        medications: ["Albuterol inhaler (as needed)"],
        conditions: ["Asthma"],
        dietaryRestrictions: [],
        emergencyContactName: "Michelle Anderson",
        emergencyContactPhone: "(555) 101-1001",
        emergencyContactRelation: "Mother",
        additionalNotes: "Inhaler should be easily accessible during intense activities.",
      },
    }),
    // Olivia Chen - no medical concerns
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-3` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-3`,
        allergies: [],
        medications: [],
        conditions: [],
        dietaryRestrictions: [],
        emergencyContactName: "Jennifer Chen",
        emergencyContactPhone: "(555) 102-1002",
        emergencyContactRelation: "Mother",
      },
    }),
    // Mason Williams - ADHD
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-5` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-5`,
        allergies: ["Bee Stings"],
        medications: ["Adderall (morning)"],
        conditions: ["ADHD"],
        dietaryRestrictions: [],
        emergencyContactName: "Robert Williams",
        emergencyContactPhone: "(555) 103-1003",
        emergencyContactRelation: "Father",
        additionalNotes: "Takes medication before school. May need extra patience with instructions.",
      },
    }),
    // Ava Patel - lactose intolerant
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG1_ID}-ath-6` },
      update: {},
      create: {
        athleteId: `${ORG1_ID}-ath-6`,
        allergies: [],
        medications: [],
        conditions: [],
        dietaryRestrictions: ["Dairy-Free", "Vegetarian"],
        emergencyContactName: "Priya Patel",
        emergencyContactPhone: "(555) 104-1004",
        emergencyContactRelation: "Mother",
      },
    }),
    // Metro Sports athlete - Michael Chen
    prisma.athleteMedicalInfo.upsert({
      where: { athleteId: `${ORG2_ID}-ath-1` },
      update: {},
      create: {
        athleteId: `${ORG2_ID}-ath-1`,
        allergies: ["Shellfish"],
        medications: [],
        conditions: [],
        dietaryRestrictions: [],
        emergencyContactName: "David Chen",
        emergencyContactPhone: "(555) 401-4001",
        emergencyContactRelation: "Father",
        insuranceProvider: "Blue Cross Blue Shield",
        insurancePolicyNumber: "BCBS-12345678",
      },
    }),
  ]);

  console.log(`  ✓ Created ${medicalInfoRecords.length} athlete medical info records`);

  // Custom Medical Responses
  console.log("📋 Creating custom medical responses...");
  const emilyMedicalInfo = medicalInfoRecords[0];
  const sophieMedicalInfo = medicalInfoRecords[1];
  
  await Promise.all([
    // Emily's responses
    prisma.customMedicalResponse.upsert({
      where: { medicalInfoId_questionId: { medicalInfoId: emilyMedicalInfo.id, questionId: `${ORG1_ID}-mq-1` } },
      update: {},
      create: {
        medicalInfoId: emilyMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-1`,
        response: "No",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: { medicalInfoId_questionId: { medicalInfoId: emilyMedicalInfo.id, questionId: `${ORG1_ID}-mq-2` } },
      update: {},
      create: {
        medicalInfoId: emilyMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-2`,
        response: "Intermediate - Some classes",
      },
    }),
    // Sophie's responses
    prisma.customMedicalResponse.upsert({
      where: { medicalInfoId_questionId: { medicalInfoId: sophieMedicalInfo.id, questionId: `${ORG1_ID}-mq-1` } },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-1`,
        response: "No",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: { medicalInfoId_questionId: { medicalInfoId: sophieMedicalInfo.id, questionId: `${ORG1_ID}-mq-2` } },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-2`,
        response: "Advanced - Competitive experience",
      },
    }),
    prisma.customMedicalResponse.upsert({
      where: { medicalInfoId_questionId: { medicalInfoId: sophieMedicalInfo.id, questionId: `${ORG1_ID}-mq-3` } },
      update: {},
      create: {
        medicalInfoId: sophieMedicalInfo.id,
        questionId: `${ORG1_ID}-mq-3`,
        response: "No specific fears. She loves tumbling!",
      },
    }),
  ]);

  console.log("  ✓ Created 5 custom medical responses");

  // ============================================
  // RESERVED DOMAINS - System and Brand Protection
  // ============================================
  console.log("\n🔒 Creating reserved domains...");
  const reservedDomainData = [
    // System portals - middleware routes (CRITICAL: these are routed by middleware)
    { pattern: "login", type: "EXACT" as const, reason: "System use - login portal" },
    { pattern: "admin", type: "EXACT" as const, reason: "System use - admin portal" },
    { pattern: "superadmin", type: "EXACT" as const, reason: "System use - superadmin portal" },
    { pattern: "coach", type: "EXACT" as const, reason: "System use - coach portal" },
    { pattern: "athletes", type: "EXACT" as const, reason: "System use - athletes portal" },
    { pattern: "pos", type: "EXACT" as const, reason: "System use - POS portal" },
    { pattern: "feedback", type: "EXACT" as const, reason: "System use - feedback portal" },
    { pattern: "events", type: "EXACT" as const, reason: "System use - events portal" },
    { pattern: "startup", type: "EXACT" as const, reason: "System use - org signup portal" },
    
    // Infrastructure
    { pattern: "api", type: "EXACT" as const, reason: "System use - API endpoint" },
    { pattern: "app", type: "EXACT" as const, reason: "System use - application" },
    { pattern: "www", type: "EXACT" as const, reason: "System use - main website" },
    { pattern: "mail", type: "EXACT" as const, reason: "System use - email services" },
    { pattern: "cdn", type: "EXACT" as const, reason: "System use - content delivery" },
    { pattern: "static", type: "EXACT" as const, reason: "System use - static assets" },
    { pattern: "assets", type: "EXACT" as const, reason: "System use - asset hosting" },
    { pattern: "images", type: "EXACT" as const, reason: "System use - image hosting" },
    { pattern: "files", type: "EXACT" as const, reason: "System use - file hosting" },
    { pattern: "download", type: "EXACT" as const, reason: "System use - downloads" },
    { pattern: "upload", type: "EXACT" as const, reason: "System use - uploads" },
    { pattern: "dashboard", type: "EXACT" as const, reason: "System use - dashboard routes" },
    
    // Support & Documentation
    { pattern: "help", type: "EXACT" as const, reason: "System use - help center" },
    { pattern: "support", type: "EXACT" as const, reason: "System use - support portal" },
    { pattern: "status", type: "EXACT" as const, reason: "System use - status page" },
    { pattern: "docs", type: "EXACT" as const, reason: "System use - documentation" },
    { pattern: "blog", type: "EXACT" as const, reason: "System use - blog" },
    
    // Account management
    { pattern: "signup", type: "EXACT" as const, reason: "System use - signup pages" },
    { pattern: "register", type: "EXACT" as const, reason: "System use - registration" },
    { pattern: "account", type: "EXACT" as const, reason: "System use - account management" },
    { pattern: "settings", type: "EXACT" as const, reason: "System use - settings pages" },
    { pattern: "billing", type: "EXACT" as const, reason: "System use - billing portal" },
    { pattern: "payment", type: "EXACT" as const, reason: "System use - payment pages" },
    { pattern: "checkout", type: "EXACT" as const, reason: "System use - checkout" },
    
    // Brand protection
    { pattern: "uplifter", type: "EXACT" as const, reason: "Brand protection - Uplifter trademark" },
    { pattern: "leapfrog", type: "EXACT" as const, reason: "Brand protection - LeapFrog trademark" },
    
    // Reserved words - exact matches
    { pattern: "test", type: "EXACT" as const, reason: "System use - reserved word" },
    { pattern: "demo", type: "EXACT" as const, reason: "System use - reserved word" },
    
    // Prefix reserved - blocks anything starting with pattern
    { pattern: "test-", type: "PREFIX" as const, reason: "System use - testing environments" },
    { pattern: "demo-", type: "PREFIX" as const, reason: "System use - demo environments" },
    { pattern: "staging-", type: "PREFIX" as const, reason: "System use - staging environments" },
    { pattern: "dev-", type: "PREFIX" as const, reason: "System use - development environments" },
  ];
  for (const rd of reservedDomainData) {
    await prisma.reservedDomain.upsert({
      where: { pattern: rd.pattern },
      update: {},
      create: rd,
    });
  }
  console.log(`  ✓ Created ${reservedDomainData.length} reserved domains`);

  // ============================================
  // COMPLETE
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Development seed completed successfully!");
  console.log("=".repeat(50));
  console.log("\nCreated data summary:");
  console.log("  • 4 organizations (Sunrise Gymnastics, Metro Sports, Demo Gym, Uplifter)");
  console.log("  • 4 subscription plans");
  console.log("  • 10 users with permissions");
  console.log("  • 9 families with payment methods");
  console.log("  • 14 athletes with guardian relationships");
  console.log("  • 9 programs with membership tiers");
  console.log("  • 12 program staff assignments (coaches)");
  console.log("  • 3 programs with membership requirements");
  console.log("  • 29+ events with 40+ attendance records (historical + current)");
  console.log("  • 5 invoices with line items and payments");
  console.log("  • 9 transactions (Adyen)");
  console.log("  • 5 payouts (settlements)");
  console.log("  • 7 recurring charges");
  console.log("  • 34 gymnastics skills with difficulty levels and age ranges");
  console.log("  • 5 evaluation templates with skill groupings");
  console.log("  • 5 evaluations with skill attempt statuses");
  console.log("  • 11 athlete skill progress records");
  console.log("  • Lesson plans and rotations");
  console.log("  • 7 POS products with stock movements");
  console.log("  • 6 media items (photos/videos)");
  console.log("  • 5 staff profiles with availability");
  console.log("  • 10 shifts (historical + scheduled)");
  console.log("  • 2 schedule templates with entries");
  console.log("  • 10 event staff assignments");
  console.log("  • 2 medical form configs with custom questions");
  console.log("  • 6 athlete medical info records with responses");
  console.log("  • 14 reserved domains");
  console.log("  • 90 days of visitor analytics (if Redis configured)");
  console.log("\nTest accounts (password: password123):");
  console.log("  Sunrise Gym Admin: admin@sunrise-gymnastics.com");
  console.log("  Metro Sports Admin: admin@metro-sports.com");
  console.log("  Demo Gym Admin: admin@demo.com");
  console.log("  Demo Gym Coach: coach@demo.com");
  console.log("  Superadmin: andrewkarzel@uplifterinc.com");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
