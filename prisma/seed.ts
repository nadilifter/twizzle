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

/** Parse a YYYY-MM-DD string as noon UTC to prevent timezone date shifts */
function noonUTC(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}
async function main() {
  console.log("🌱 Starting development seed...\n");

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================
  console.log("📋 Creating subscription plans...");
  
  // Use slug for where clause to be idempotent regardless of IDs
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "free" },
    update: {
      // Update existing plans with email limits
      emailIncluded: null, // No email campaigns on free plan
      emailOverageRate: null,
      maxStorageMB: 500, // 500 MB
      maxMembershipTypes: 2,
      featureToggles: {
        events: false, sms: false, emailCampaigns: false,
        customDomains: false, accountingIntegrations: false, training: false, store: false, memberships: false, waitlists: false, passes: false,
        liveSupport: false,
      },
    },
    create: {
      name: "Free", slug: "free", description: "Perfect for getting started",
      monthlyPrice: 0, yearlyPrice: 0, transactionFee: 0.05, perTransactionFee: 0.50,
      maxAthletes: 25, maxUsers: 2, maxPrograms: 3, maxEvents: 10,
      smsIncluded: null, smsOverageRate: null,
      emailIncluded: null, emailOverageRate: null, // No email campaigns on free plan
      maxStorageMB: 500, // 500 MB
      maxMembershipTypes: 2,
      features: ["Basic scheduling", "Up to 25 athletes", "Email support", "500 MB storage"],
      featureToggles: {
        events: false, sms: false, emailCampaigns: false,
        customDomains: false, accountingIntegrations: false, training: false, store: false, memberships: false, waitlists: false, passes: false,
        liveSupport: false,
      },
      isPopular: false, displayOrder: 0, isActive: true, isPublic: true,
    },
  });
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "starter" },
    update: {
      emailIncluded: 500, // 500 emails/month
      emailOverageRate: 0.005, // $0.005 per email over limit
      maxStorageMB: 2000, // 2 GB
      maxMembershipTypes: 5,
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: false, accountingIntegrations: false, training: false, store: true, memberships: false, waitlists: true, passes: false,
        liveSupport: false,
      },
    },
    create: {
      name: "Starter", slug: "starter", description: "For growing organizations",
      monthlyPrice: 49, yearlyPrice: 470, transactionFee: 0.035, perTransactionFee: 0.35,
      maxAthletes: 100, maxUsers: 5, maxPrograms: 10, maxEvents: 50,
      smsIncluded: 100, smsOverageRate: 0.05,
      emailIncluded: 500, emailOverageRate: 0.005, // 500 emails/month, $0.005 per extra
      maxStorageMB: 2000, // 2 GB
      maxMembershipTypes: 5,
      features: ["Advanced scheduling", "Up to 100 athletes", "Priority email support", "Basic reporting", "500 email campaigns/month", "2 GB storage"],
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: false, accountingIntegrations: false, training: false, store: true, memberships: false, waitlists: true, passes: false,
        liveSupport: false,
      },
      isPopular: false, displayOrder: 1, isActive: true, isPublic: true,
    },
  });
  const goldPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "gold" },
    update: {
      emailIncluded: 2500, // 2500 emails/month
      emailOverageRate: 0.003, // $0.003 per email over limit
      maxStorageMB: 10000, // 10 GB
      maxMembershipTypes: 15,
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: true, accountingIntegrations: false, training: true, store: true, memberships: false, waitlists: true, passes: true,
        liveSupport: true,
      },
    },
    create: {
      name: "Gold", slug: "gold", description: "Most popular for established clubs",
      monthlyPrice: 149, yearlyPrice: 1430, transactionFee: 0.029, perTransactionFee: 0.30,
      maxAthletes: 500, maxUsers: 15, maxPrograms: 50, maxEvents: null,
      smsIncluded: 500, smsOverageRate: 0.04,
      emailIncluded: 2500, emailOverageRate: 0.003, // 2500 emails/month, $0.003 per extra
      maxStorageMB: 10000, // 10 GB
      maxMembershipTypes: 15,
      features: ["Unlimited events", "Up to 500 athletes", "Phone support", "Advanced reporting", "Custom branding", "2,500 email campaigns/month", "10 GB storage"],
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: true, accountingIntegrations: false, training: true, store: true, memberships: false, waitlists: true, passes: true,
        liveSupport: true,
      },
      isPopular: true, displayOrder: 2, isActive: true, isPublic: true,
    },
  });
  const platinumPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "platinum" },
    update: {
      emailIncluded: 10000, // 10000 emails/month
      emailOverageRate: 0.002, // $0.002 per email over limit
      maxStorageMB: null, // Unlimited
      maxMembershipTypes: null, // Unlimited
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: true, accountingIntegrations: true, training: true, store: true, memberships: false, waitlists: true, passes: true,
        liveSupport: true,
      },
    },
    create: {
      name: "Platinum", slug: "platinum", description: "Enterprise-grade solution",
      monthlyPrice: 349, yearlyPrice: 3350, transactionFee: 0.025, perTransactionFee: 0.25,
      maxAthletes: null, maxUsers: null, maxPrograms: null, maxEvents: null,
      smsIncluded: 2000, smsOverageRate: 0.03,
      emailIncluded: 10000, emailOverageRate: 0.002, // 10000 emails/month, $0.002 per extra
      maxStorageMB: null, // Unlimited
      maxMembershipTypes: null, // Unlimited
      features: ["Unlimited everything", "Dedicated support", "Custom integrations", "White-label options", "SLA guarantee", "10,000 email campaigns/month", "Unlimited storage"],
      featureToggles: {
        events: true, sms: true, emailCampaigns: true,
        customDomains: true, accountingIntegrations: true, training: true, store: true, memberships: false, waitlists: true, passes: true,
        liveSupport: true,
      },
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
    create: { 
      id: ORG1_ID, name: "Sunrise Gymnastics Academy", slug: "sunrise-gymnastics",
      email: "info@sunrisegymnastics.com", phone: "+15551234567",
      street: "100 Sunrise Blvd", city: "Austin", stateProvince: "TX", postalCode: "78701", country: "US"
    },
  });
  const org2 = await prisma.organization.upsert({
    where: { id: ORG2_ID }, update: {},
    create: { 
      id: ORG2_ID, name: "Metro Sports Complex", slug: "metro-sports",
      email: "hello@metrosports.com", phone: "+15559876543",
      street: "250 Metro Way", city: "Denver", stateProvince: "CO", postalCode: "80202", country: "US"
    },
  });
  console.log(`  ✓ Created: ${org1.name}`);
  console.log(`  ✓ Created: ${org2.name}`);

  // Demo Gym and Uplifter (from original seed.ts)
  const orgDemo = await prisma.organization.upsert({
    where: { slug: "demo-gym" }, update: {},
    create: { 
      id: ORG_DEMO_ID, name: "Demo Gymnastics Club", slug: "demo-gym",
      email: "demo@demogym.com", phone: "+15550001111",
      street: "500 Demo Lane", city: "Portland", stateProvince: "OR", postalCode: "97201", country: "US"
    },
  });
  const orgUplifter = await prisma.organization.upsert({
    where: { slug: "uplifter" }, update: {},
    create: { 
      id: ORG_UPLIFTER_ID, name: "Uplifter", slug: "uplifter",
      email: "admin@uplifterinc.com", phone: "+15550009999",
      street: "1 Platform Plaza", city: "San Francisco", stateProvince: "CA", postalCode: "94105", country: "US"
    },
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
  // SPORTS
  // ============================================
  console.log("\n🏅 Creating sports...");
  const sportsData = [
    { id: "sport-athletics", name: "Athletics", slug: "athletics", description: "Track and field athletics including running, jumping, and throwing disciplines", displayOrder: 0 },
    { id: "sport-gymnastics", name: "Gymnastics", slug: "gymnastics", description: "Artistic and rhythmic gymnastics with apparatus events and floor exercises", displayOrder: 1 },
    { id: "sport-swimming", name: "Swimming", slug: "swimming", description: "Competitive and recreational swimming across all strokes and distances", displayOrder: 2 },
    { id: "sport-skiing", name: "Skiing", slug: "skiing", description: "Alpine and cross-country skiing disciplines", displayOrder: 3 },
    { id: "sport-diving", name: "Diving", slug: "diving", description: "Springboard and platform diving competitions", displayOrder: 4 },
    { id: "sport-basketball", name: "Basketball", slug: "basketball", description: "Team basketball programs and competitions", displayOrder: 5 },
  ];

  const sports: Record<string, { id: string; slug: string }> = {};
  for (const sport of sportsData) {
    const result = await prisma.sport.upsert({
      where: { slug: sport.slug },
      update: {},
      create: sport,
    });
    sports[sport.slug] = { id: result.id, slug: result.slug };
  }
  console.log(`  ✓ Created ${sportsData.length} sports`);

  // Organization-Sport associations
  console.log("\n🔗 Associating sports with organizations...");
  const orgSportAssociations = [
    { organizationId: ORG1_ID, sportId: sports["gymnastics"].id },
    { organizationId: ORG2_ID, sportId: sports["basketball"].id },
    { organizationId: ORG2_ID, sportId: sports["swimming"].id },
    { organizationId: ORG2_ID, sportId: sports["athletics"].id },
    { organizationId: ORG_DEMO_ID, sportId: sports["gymnastics"].id },
  ];

  for (const assoc of orgSportAssociations) {
    await prisma.organizationSport.upsert({
      where: {
        organizationId_sportId: {
          organizationId: assoc.organizationId,
          sportId: assoc.sportId,
        },
      },
      update: {},
      create: assoc,
    });
  }
  console.log("  ✓ Associated sports with organizations");

  // ============================================
  // COMPETITION CATEGORY TEMPLATES
  // ============================================
  console.log("\n🏷️  Creating competition category templates...");

  // --- Gymnastics: Age Group x Apparatus (COMBINATION) ---
  const gymTemplate = await prisma.competitionCategoryTemplate.upsert({
    where: { id: "cat-tmpl-gymnastics-age-apparatus" },
    update: {},
    create: {
      id: "cat-tmpl-gymnastics-age-apparatus",
      sportId: sports["gymnastics"].id,
      name: "Age Group x Apparatus",
      description: "Standard gymnastics competition categories organized by age group and apparatus",
      type: "COMBINATION",
      isActive: true,
      displayOrder: 0,
      rowAxisLabel: "Age Group",
      columnAxisLabel: "Apparatus",
      restrictionAxis: "ROW",
    },
  });

  const gymRowData = [
    { id: "cav-gym-u8",   name: "Under 8",  axis: "ROW" as const, displayOrder: 0, minAge: 0,  maxAge: 7  },
    { id: "cav-gym-u10",  name: "Under 10", axis: "ROW" as const, displayOrder: 1, minAge: 8,  maxAge: 9  },
    { id: "cav-gym-u12",  name: "Under 12", axis: "ROW" as const, displayOrder: 2, minAge: 10, maxAge: 11 },
    { id: "cav-gym-u14",  name: "Under 14", axis: "ROW" as const, displayOrder: 3, minAge: 12, maxAge: 13 },
    { id: "cav-gym-open", name: "Open",      axis: "ROW" as const, displayOrder: 4, minAge: 14, maxAge: null },
  ];
  const gymColData = [
    { id: "cav-gym-floor", name: "Floor", axis: "COLUMN" as const, displayOrder: 0, resultType: "SCORE" as const, sortDirection: "DESC" as const },
    { id: "cav-gym-vault", name: "Vault", axis: "COLUMN" as const, displayOrder: 1, resultType: "SCORE" as const, sortDirection: "DESC" as const },
    { id: "cav-gym-bars",  name: "Bars",  axis: "COLUMN" as const, displayOrder: 2, resultType: "SCORE" as const, sortDirection: "DESC" as const },
    { id: "cav-gym-beam",  name: "Beam",  axis: "COLUMN" as const, displayOrder: 3, resultType: "SCORE" as const, sortDirection: "DESC" as const },
  ];

  for (const row of gymRowData) {
    await prisma.categoryAxisValue.upsert({
      where: { id: row.id },
      update: {},
      create: { ...row, templateId: gymTemplate.id },
    });
  }
  for (const col of gymColData) {
    await prisma.categoryAxisValue.upsert({
      where: { id: col.id },
      update: {},
      create: { ...col, templateId: gymTemplate.id },
    });
  }

  // Generate combination entries (disable Under 8 - Bars as an example)
  const gymDisabled = new Set(["cav-gym-u8:cav-gym-bars"]);
  for (const row of gymRowData) {
    for (const col of gymColData) {
      const comboId = `combo-gym-${row.id}-${col.id}`;
      const key = `${row.id}:${col.id}`;
      await prisma.categoryCombinationEntry.upsert({
        where: { id: comboId },
        update: {},
        create: {
          id: comboId,
          templateId: gymTemplate.id,
          rowValueId: row.id,
          colValueId: col.id,
          isActive: !gymDisabled.has(key),
          name: `${row.name} - ${col.name}`,
        },
      });
    }
  }
  console.log("  ✓ Created Gymnastics: Age Group x Apparatus template");

  // --- Athletics: Sport-Specific Events & Age Categories ---
  console.log("\n🏃 Creating Athletics sport-specific data...");
  const athleticsSportId = sports["athletics"].id;

  const athleticsEventsData = [
    { id: "athl-evt-100M",     code: "100M",     name: "100m",               eventGroup: "sprints",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 0 },
    { id: "athl-evt-200M",     code: "200M",     name: "200m",               eventGroup: "sprints",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 1 },
    { id: "athl-evt-400M",     code: "400M",     name: "400m",               eventGroup: "sprints",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 2 },
    { id: "athl-evt-100H",     code: "100H",     name: "100m Hurdles",       eventGroup: "hurdles",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 3 },
    { id: "athl-evt-110H",     code: "110H",     name: "110m Hurdles",       eventGroup: "hurdles",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 4 },
    { id: "athl-evt-400H",     code: "400H",     name: "400m Hurdles",       eventGroup: "hurdles",          eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 5 },
    { id: "athl-evt-800M",     code: "800M",     name: "800m",               eventGroup: "middle_distance",  eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 6 },
    { id: "athl-evt-1500M",    code: "1500M",    name: "1500m",              eventGroup: "middle_distance",  eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 7 },
    { id: "athl-evt-3000M",    code: "3000M",    name: "3000m",              eventGroup: "distance",         eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 8 },
    { id: "athl-evt-STEEPLE",  code: "STEEPLE",  name: "3000m Steeplechase", eventGroup: "distance",         eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 9 },
    { id: "athl-evt-5000M",    code: "5000M",    name: "5000m",              eventGroup: "distance",         eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 10 },
    { id: "athl-evt-10000M",   code: "10000M",   name: "10000m",             eventGroup: "distance",         eventType: "track",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 11 },
    { id: "athl-evt-4X100",    code: "4X100",    name: "4x100 Relay",        eventGroup: "relays",           eventType: "relay",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 12 },
    { id: "athl-evt-4X400",    code: "4X400",    name: "4x400 Relay",        eventGroup: "relays",           eventType: "relay",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 13 },
    { id: "athl-evt-4X400MX",  code: "4X400MX",  name: "4x400 Mixed Relay",  eventGroup: "relays",           eventType: "relay",    resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 14 },
    { id: "athl-evt-HJ",       code: "HJ",       name: "High Jump",          eventGroup: "jumps",            eventType: "field",    resultType: "HEIGHT" as const,   sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 15 },
    { id: "athl-evt-LJ",       code: "LJ",       name: "Long Jump",          eventGroup: "jumps",            eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 16 },
    { id: "athl-evt-TJ",       code: "TJ",       name: "Triple Jump",        eventGroup: "jumps",            eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 17 },
    { id: "athl-evt-PV",       code: "PV",       name: "Pole Vault",         eventGroup: "jumps",            eventType: "field",    resultType: "HEIGHT" as const,   sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 18 },
    { id: "athl-evt-SP",       code: "SP",       name: "Shot Put",           eventGroup: "throws",           eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 19 },
    { id: "athl-evt-DT",       code: "DT",       name: "Discus",             eventGroup: "throws",           eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 20 },
    { id: "athl-evt-HT",       code: "HT",       name: "Hammer Throw",       eventGroup: "throws",           eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 21 },
    { id: "athl-evt-JT",       code: "JT",       name: "Javelin",            eventGroup: "throws",           eventType: "field",    resultType: "DISTANCE" as const, sortDirection: "DESC" as const, defaultPrecision: 2, displayOrder: 22 },
    { id: "athl-evt-HEPT",     code: "HEPT",     name: "Heptathlon",         eventGroup: "combined",         eventType: "combined", resultType: "SCORE" as const,    sortDirection: "DESC" as const, defaultPrecision: 0, displayOrder: 23 },
    { id: "athl-evt-DECA",     code: "DECA",     name: "Decathlon",          eventGroup: "combined",         eventType: "combined", resultType: "SCORE" as const,    sortDirection: "DESC" as const, defaultPrecision: 0, displayOrder: 24 },
    { id: "athl-evt-RW5K",     code: "RW5K",     name: "5000m Race Walk",    eventGroup: "racewalk",         eventType: "racewalk", resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 25 },
    { id: "athl-evt-RW10K",    code: "RW10K",    name: "10000m Race Walk",   eventGroup: "racewalk",         eventType: "racewalk", resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 26 },
    { id: "athl-evt-RW20K",    code: "RW20K",    name: "20km Race Walk",     eventGroup: "racewalk",         eventType: "racewalk", resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 27 },
    { id: "athl-evt-RW35K",    code: "RW35K",    name: "35km Race Walk",     eventGroup: "racewalk",         eventType: "racewalk", resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 28 },
    { id: "athl-evt-ROAD5K",   code: "ROAD5K",   name: "5km Road",           eventGroup: "road",             eventType: "road",     resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 29 },
    { id: "athl-evt-ROAD10K",  code: "ROAD10K",  name: "10km Road",          eventGroup: "road",             eventType: "road",     resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 30 },
    { id: "athl-evt-HALF",     code: "HALF",     name: "Half Marathon",      eventGroup: "road",             eventType: "road",     resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 31 },
    { id: "athl-evt-MAR",      code: "MAR",      name: "Marathon",           eventGroup: "road",             eventType: "road",     resultType: "TIME" as const,     sortDirection: "ASC" as const,  defaultPrecision: 3, displayOrder: 32 },
  ];

  for (const evt of athleticsEventsData) {
    await prisma.sportEvent.upsert({
      where: { id: evt.id },
      update: {},
      create: { ...evt, sportId: athleticsSportId },
    });
  }
  console.log(`  ✓ Created ${athleticsEventsData.length} athletics events`);

  const athleticsAgeCatsData = [
    { id: "athl-age-U10",  code: "U10",  name: "Under 10", minAge: 8,  maxAge: 9,    displayOrder: 0 },
    { id: "athl-age-U12",  code: "U12",  name: "Under 12", minAge: 10, maxAge: 11,   displayOrder: 1 },
    { id: "athl-age-U14",  code: "U14",  name: "Under 14", minAge: 12, maxAge: 13,   displayOrder: 2 },
    { id: "athl-age-U16",  code: "U16",  name: "Under 16", minAge: 14, maxAge: 15,   displayOrder: 3 },
    { id: "athl-age-U18",  code: "U18",  name: "Under 18", minAge: 16, maxAge: 17,   displayOrder: 4 },
    { id: "athl-age-U20",  code: "U20",  name: "Under 20", minAge: 18, maxAge: 19,   displayOrder: 5 },
    { id: "athl-age-SEN",  code: "SEN",  name: "Senior",   minAge: 20, maxAge: 34,   displayOrder: 6 },
    { id: "athl-age-MAS",  code: "MAS",  name: "Masters",  minAge: 35, maxAge: null,  displayOrder: 7 },
  ];

  for (const cat of athleticsAgeCatsData) {
    await prisma.sportAgeCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: { ...cat, sportId: athleticsSportId },
    });
  }
  console.log(`  ✓ Created ${athleticsAgeCatsData.length} athletics age categories`);

  // Eligibility matrix: which event+age combos are allowed
  const athleticsEligibility: Record<string, string[]> = {
    "100M":    ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "200M":    ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "400M":    ["U12","U14","U16","U18","U20","SEN","MAS"],
    "100H":    ["U14","U16","U18","U20","SEN","MAS"],
    "110H":    ["U16","U18","U20","SEN","MAS"],
    "400H":    ["U16","U18","U20","SEN","MAS"],
    "800M":    ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "1500M":   ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "3000M":   ["U12","U14","U16","U18","U20","SEN","MAS"],
    "STEEPLE": ["U16","U18","U20","SEN","MAS"],
    "5000M":   ["U16","U18","U20","SEN","MAS"],
    "10000M":  ["U18","U20","SEN","MAS"],
    "4X100":   ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "4X400":   ["U14","U16","U18","U20","SEN","MAS"],
    "4X400MX": ["U18","U20","SEN","MAS"],
    "HJ":      ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "LJ":      ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "TJ":      ["U14","U16","U18","U20","SEN","MAS"],
    "PV":      ["U14","U16","U18","U20","SEN","MAS"],
    "SP":      ["U10","U12","U14","U16","U18","U20","SEN","MAS"],
    "DT":      ["U12","U14","U16","U18","U20","SEN","MAS"],
    "JT":      ["U12","U14","U16","U18","U20","SEN","MAS"],
    "HT":      ["U14","U16","U18","U20","SEN","MAS"],
    "HEPT":    ["U14","U16","U18","U20","SEN","MAS"],
    "DECA":    ["U16","U18","U20","SEN","MAS"],
    "RW5K":    ["U14","U16","U18","U20","SEN","MAS"],
    "RW10K":   ["U16","U18","U20","SEN","MAS"],
    "RW20K":   ["U20","SEN","MAS"],
    "RW35K":   ["SEN","MAS"],
    "ROAD5K":  ["U12","U14","U16","U18","U20","SEN","MAS"],
    "ROAD10K": ["U14","U16","U18","U20","SEN","MAS"],
    "HALF":    ["U20","SEN","MAS"],
    "MAR":     ["SEN","MAS"],
  };

  let eligibilityCount = 0;
  for (const [eventCode, ageCodes] of Object.entries(athleticsEligibility)) {
    const eventId = `athl-evt-${eventCode}`;
    for (const ageCode of ageCodes) {
      const ageCatId = `athl-age-${ageCode}`;
      const eligId = `athl-elig-${eventCode}-${ageCode}`;
      await prisma.sportEventEligibility.upsert({
        where: { id: eligId },
        update: {},
        create: {
          id: eligId,
          sportEventId: eventId,
          ageCategoryId: ageCatId,
          isEnabled: true,
        },
      });
      eligibilityCount++;
    }
  }
  console.log(`  ✓ Created ${eligibilityCount} athletics eligibility entries`);

  // --- Swimming: Open Events (INDIVIDUAL) ---
  const swimTemplate = await prisma.competitionCategoryTemplate.upsert({
    where: { id: "cat-tmpl-swimming-open-events" },
    update: {},
    create: {
      id: "cat-tmpl-swimming-open-events",
      sportId: sports["swimming"].id,
      name: "Open Events",
      description: "Standard open swimming events with age-based restrictions",
      type: "INDIVIDUAL",
      isActive: true,
      displayOrder: 0,
    },
  });

  const swimEntries = [
    { id: "cie-swim-50free",    name: "50m Freestyle",    displayOrder: 0, hasAgeRestriction: false, minAge: null, maxAge: null, resultType: "TIME" as const, sortDirection: "ASC" as const },
    { id: "cie-swim-100back",   name: "100m Backstroke",  displayOrder: 1, hasAgeRestriction: true,  minAge: 8,    maxAge: null, resultType: "TIME" as const, sortDirection: "ASC" as const },
    { id: "cie-swim-200medley", name: "200m Medley",      displayOrder: 2, hasAgeRestriction: true,  minAge: 10,   maxAge: null, resultType: "TIME" as const, sortDirection: "ASC" as const },
    { id: "cie-swim-4x50relay", name: "4x50m Relay",      displayOrder: 3, hasAgeRestriction: false, minAge: null, maxAge: null, resultType: "TIME" as const, sortDirection: "ASC" as const },
  ];

  for (const entry of swimEntries) {
    await prisma.categoryIndividualEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: {
        ...entry,
        templateId: swimTemplate.id,
        hasGenderRestriction: false,
        hasCapacityRestriction: false,
      },
    });
  }
  console.log("  ✓ Created Swimming: Open Events template");

  // ============================================
  // USERS
  // ============================================
  console.log("\n👤 Creating users...");
  const org1Admin = await prisma.user.upsert({
    where: { email: "admin@sunrise-gymnastics.com" },
    update: {},
    create: { email: "admin@sunrise-gymnastics.com", name: "Jennifer Walsh", passwordHash: null, role: "ADMIN", status: "ACTIVE" },
  });
  const org1Coach1 = await prisma.user.upsert({
    where: { email: "coach.maria@sunrise-gymnastics.com" },
    update: {},
    create: { email: "coach.maria@sunrise-gymnastics.com", name: "Maria Rodriguez", passwordHash: null, role: "COACH", status: "ACTIVE" },
  });
  const org1Coach2 = await prisma.user.upsert({
    where: { email: "coach.james@sunrise-gymnastics.com" },
    update: {},
    create: { email: "coach.james@sunrise-gymnastics.com", name: "James Chen", passwordHash: null, role: "COACH", status: "ACTIVE" },
  });
  const org1Accountant = await prisma.user.upsert({
    where: { email: "finance@sunrise-gymnastics.com" },
    update: {},
    create: { email: "finance@sunrise-gymnastics.com", name: "Robert Kim", passwordHash: null, role: "ACCOUNTANT", status: "ACTIVE" },
  });
  const org2Admin = await prisma.user.upsert({
    where: { email: "admin@metro-sports.com" },
    update: {},
    create: { email: "admin@metro-sports.com", name: "Michael Thompson", passwordHash: null, role: "ADMIN", status: "ACTIVE" },
  });
  const org2Coach = await prisma.user.upsert({
    where: { email: "coach.sarah@metro-sports.com" },
    update: {},
    create: { email: "coach.sarah@metro-sports.com", name: "Sarah Martinez", passwordHash: null, role: "COACH", status: "ACTIVE" },
  });
  const org2Volunteer = await prisma.user.upsert({
    where: { email: "volunteer@metro-sports.com" },
    update: {},
    create: { email: "volunteer@metro-sports.com", name: "David Lee", passwordHash: null, role: "VOLUNTEER", status: "ACTIVE" },
  });
  
  // Demo Gym and Uplifter users (from original seed.ts)
  const andrewUser = await prisma.user.upsert({
    where: { email: "andrewkarzel@uplifterinc.com" },
    update: { isSuperAdmin: true },
    create: { email: "andrewkarzel@uplifterinc.com", name: "Andrew Karzel", passwordHash: null, role: "ADMIN", status: "ACTIVE", isSuperAdmin: true },
  });
  const demoAdmin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: { email: "admin@demo.com", name: "Admin User", passwordHash: null, role: "ADMIN", status: "ACTIVE" },
  });
  const demoCoach = await prisma.user.upsert({
    where: { email: "coach@demo.com" },
    update: {},
    create: { email: "coach@demo.com", name: "Sarah Coach", passwordHash: null, role: "COACH", status: "ACTIVE" },
  });
  console.log("  ✓ Created 10 users across all organizations");

  // ============================================
  // ORGANIZATION MEMBERS
  // ============================================
  console.log("\n👥 Creating organization memberships...");
  const org1AdminMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Admin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { id: `${ORG1_ID}-member-admin`, organizationId: ORG1_ID, userId: org1Admin.id, role: "ADMIN", status: "ACTIVE" },
  });
  const org1Coach1Member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Coach1.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: { id: `${ORG1_ID}-staff-1`, organizationId: ORG1_ID, userId: org1Coach1.id, role: "COACH", status: "ACTIVE" },
  });
  const org1Coach2Member = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Coach2.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: { id: `${ORG1_ID}-staff-2`, organizationId: ORG1_ID, userId: org1Coach2.id, role: "COACH", status: "ACTIVE" },
  });
  const org1AccountantMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG1_ID, userId: org1Accountant.id } },
    update: { role: "ACCOUNTANT", status: "ACTIVE" },
    create: { id: `${ORG1_ID}-staff-3`, organizationId: ORG1_ID, userId: org1Accountant.id, role: "ACCOUNTANT", status: "ACTIVE" },
  });
  const org2AdminMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG2_ID, userId: org2Admin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { id: `${ORG2_ID}-member-admin`, organizationId: ORG2_ID, userId: org2Admin.id, role: "ADMIN", status: "ACTIVE" },
  });
  const org2CoachMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG2_ID, userId: org2Coach.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: { id: `${ORG2_ID}-staff-1`, organizationId: ORG2_ID, userId: org2Coach.id, role: "COACH", status: "ACTIVE" },
  });
  const org2VolunteerMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG2_ID, userId: org2Volunteer.id } },
    update: { role: "VOLUNTEER", status: "ACTIVE" },
    create: { id: `${ORG2_ID}-staff-2`, organizationId: ORG2_ID, userId: org2Volunteer.id, role: "VOLUNTEER", status: "ACTIVE" },
  });
  // Maria Rodriguez coaches at both Sunrise and Metro
  const org2MariaCoachMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: ORG2_ID, userId: org1Coach1.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: { id: `${ORG2_ID}-member-maria`, organizationId: ORG2_ID, userId: org1Coach1.id, role: "COACH", status: "ACTIVE" },
  });
  // Demo Gym and Uplifter memberships
  const uplifterAndrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgUplifter.id, userId: andrewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { id: `${ORG_UPLIFTER_ID}-member-andrew`, organizationId: orgUplifter.id, userId: andrewUser.id, role: "ADMIN", status: "ACTIVE" },
  });
  const demoAndrewMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: andrewUser.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { id: `${ORG_DEMO_ID}-member-andrew`, organizationId: orgDemo.id, userId: andrewUser.id, role: "ADMIN", status: "ACTIVE" },
  });
  const demoAdminMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: demoAdmin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: { id: `${ORG_DEMO_ID}-member-admin`, organizationId: orgDemo.id, userId: demoAdmin.id, role: "ADMIN", status: "ACTIVE" },
  });
  const demoCoachMember = await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: orgDemo.id, userId: demoCoach.id } },
    update: { role: "COACH", status: "ACTIVE" },
    create: { id: `${ORG_DEMO_ID}-member-coach`, organizationId: orgDemo.id, userId: demoCoach.id, role: "COACH", status: "ACTIVE" },
  });
  console.log("  ✓ Created 12 organization memberships");

  // ============================================
  // MEMBER PERMISSIONS
  // ============================================
  console.log("\n🔐 Creating member permissions...");
  const permissionData = [
    { memberId: org1AdminMember.id, permission: "*" },
    { memberId: org2AdminMember.id, permission: "*" },
    { memberId: org1Coach1Member.id, permission: "dashboard.view" },
    { memberId: org1Coach1Member.id, permission: "athletes.view" },
    { memberId: org1Coach1Member.id, permission: "athletes.edit" },
    { memberId: org1Coach1Member.id, permission: "training.view" },
    { memberId: org1Coach1Member.id, permission: "training.create" },
    { memberId: org1Coach1Member.id, permission: "events.view" },
    { memberId: org1Coach1Member.id, permission: "coaching.portal" },
    { memberId: org1Coach1Member.id, permission: "coaching.assign" },
    { memberId: org1Coach1Member.id, permission: "coaching.attendance" },
    { memberId: org1Coach1Member.id, permission: "coaching.evaluations" },
    { memberId: org1Coach2Member.id, permission: "dashboard.view" },
    { memberId: org1Coach2Member.id, permission: "athletes.view" },
    { memberId: org1Coach2Member.id, permission: "training.view" },
    { memberId: org1Coach2Member.id, permission: "coaching.portal" },
    { memberId: org1Coach2Member.id, permission: "coaching.assign" },
    { memberId: org1Coach2Member.id, permission: "coaching.attendance" },
    { memberId: org2CoachMember.id, permission: "dashboard.view" },
    { memberId: org2CoachMember.id, permission: "athletes.view" },
    { memberId: org2CoachMember.id, permission: "events.view" },
    { memberId: org2CoachMember.id, permission: "coaching.portal" },
    { memberId: org2CoachMember.id, permission: "coaching.assign" },
    { memberId: org2CoachMember.id, permission: "coaching.attendance" },
    { memberId: org2CoachMember.id, permission: "coaching.evaluations" },
    // Maria Rodriguez at Metro (multi-org coach)
    { memberId: org2MariaCoachMember.id, permission: "dashboard.view" },
    { memberId: org2MariaCoachMember.id, permission: "athletes.view" },
    { memberId: org2MariaCoachMember.id, permission: "athletes.edit" },
    { memberId: org2MariaCoachMember.id, permission: "events.view" },
    { memberId: org2MariaCoachMember.id, permission: "coaching.portal" },
    { memberId: org2MariaCoachMember.id, permission: "coaching.assign" },
    { memberId: org2MariaCoachMember.id, permission: "coaching.attendance" },
    { memberId: org2MariaCoachMember.id, permission: "coaching.evaluations" },
    { memberId: org1AccountantMember.id, permission: "dashboard.view" },
    { memberId: org1AccountantMember.id, permission: "financials.view" },
    { memberId: org1AccountantMember.id, permission: "financials.edit" },
    { memberId: org1AccountantMember.id, permission: "invoices.view" },
    { memberId: org1AccountantMember.id, permission: "invoices.create" },
    { memberId: org2VolunteerMember.id, permission: "dashboard.view" },
    { memberId: org2VolunteerMember.id, permission: "events.view" },
    // Demo Gym and Uplifter permissions
    { memberId: uplifterAndrewMember.id, permission: "*" },
    { memberId: demoAndrewMember.id, permission: "*" },
    { memberId: demoAdminMember.id, permission: "*" },
    { memberId: demoCoachMember.id, permission: "dashboard.view" },
    { memberId: demoCoachMember.id, permission: "athletes.view" },
    { memberId: demoCoachMember.id, permission: "athletes.edit" },
    { memberId: demoCoachMember.id, permission: "training.view" },
    { memberId: demoCoachMember.id, permission: "training.create" },
    { memberId: demoCoachMember.id, permission: "training.edit" },
    { memberId: demoCoachMember.id, permission: "events.view" },
    { memberId: demoCoachMember.id, permission: "events.create" },
    { memberId: demoCoachMember.id, permission: "events.edit" },
    { memberId: demoCoachMember.id, permission: "coaching.portal" },
    { memberId: demoCoachMember.id, permission: "coaching.assign" },
    { memberId: demoCoachMember.id, permission: "coaching.attendance" },
    { memberId: demoCoachMember.id, permission: "coaching.evaluations" },
  ];
  for (const p of permissionData) {
    await prisma.orgMemberPermission.upsert({
      where: { memberId_permission: { memberId: p.memberId, permission: p.permission } },
      update: {},
      create: { memberId: p.memberId, permission: p.permission },
    });
  }
  console.log(`  ✓ Created ${permissionData.length} member permissions`);

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
  // SPACES
  // ============================================
  console.log("\n🏋️ Creating spaces...");
  const spaceData = [
    // Org1 Main Facility
    { id: `${ORG1_ID}-space-1`, facilityId: org1Facility1.id, name: "Main Floor", capacity: 50, status: "OPEN" as const },
    { id: `${ORG1_ID}-space-2`, facilityId: org1Facility1.id, name: "Vault Runway", capacity: 15, status: "OPEN" as const },
    { id: `${ORG1_ID}-space-3`, facilityId: org1Facility1.id, name: "Uneven Bars", capacity: 20, status: "MAINTENANCE" as const },
    { id: `${ORG1_ID}-space-4`, facilityId: org1Facility1.id, name: "Beam Area", capacity: 25, status: "OPEN" as const },
    { id: `${ORG1_ID}-space-5`, facilityId: org1Facility1.id, name: "Tumble Track", capacity: 10, status: "OPEN" as const },
    // Org1 Satellite Facility
    { id: `${ORG1_ID}-space-6`, facilityId: org1Facility2.id, name: "Preschool Area", capacity: 30, status: "OPEN" as const },
    { id: `${ORG1_ID}-space-7`, facilityId: org1Facility2.id, name: "Recreational Floor", capacity: 25, status: "OPEN" as const },
    // Org2 Main Facility
    { id: `${ORG2_ID}-space-1`, facilityId: org2Facility.id, name: "Basketball Court A", capacity: 30, status: "OPEN" as const },
    { id: `${ORG2_ID}-space-2`, facilityId: org2Facility.id, name: "Basketball Court B", capacity: 30, status: "OPEN" as const },
    { id: `${ORG2_ID}-space-3`, facilityId: org2Facility.id, name: "Soccer Field", capacity: 50, status: "OPEN" as const },
    { id: `${ORG2_ID}-space-4`, facilityId: org2Facility.id, name: "Swimming Pool", capacity: 40, status: "OPEN" as const },
    { id: `${ORG2_ID}-space-5`, facilityId: org2Facility.id, name: "Fitness Room", capacity: 25, status: "MAINTENANCE" as const },
  ];
  await Promise.all(spaceData.map((z) =>
    prisma.space.upsert({
      where: { id: z.id },
      update: {},
      create: z,
    })
  ));
  console.log(`  ✓ Created ${spaceData.length} spaces`);

  // ============================================
  // SPACE AVAILABILITY
  // ============================================
  console.log("\n🕐 Creating space availability hours...");
  const spaceAvailabilityData = [
    // Org1 Main Facility - Main Floor: Mon-Fri 7am-9pm, Sat 8am-5pm
    ...([1, 2, 3, 4, 5].map(day => ({ spaceId: `${ORG1_ID}-space-1`, dayOfWeek: day, openTime: "07:00", closeTime: "21:00" }))),
    { spaceId: `${ORG1_ID}-space-1`, dayOfWeek: 6, openTime: "08:00", closeTime: "17:00" },
    // Vault Runway: Mon-Fri 8am-8pm
    ...([1, 2, 3, 4, 5].map(day => ({ spaceId: `${ORG1_ID}-space-2`, dayOfWeek: day, openTime: "08:00", closeTime: "20:00" }))),
    // Beam Area: Mon-Sat 7am-9pm
    ...([1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG1_ID}-space-4`, dayOfWeek: day, openTime: "07:00", closeTime: "21:00" }))),
    // Tumble Track: Mon-Fri 9am-6pm
    ...([1, 2, 3, 4, 5].map(day => ({ spaceId: `${ORG1_ID}-space-5`, dayOfWeek: day, openTime: "09:00", closeTime: "18:00" }))),
    // Org1 Satellite - Preschool Area: Mon-Fri 8am-4pm
    ...([1, 2, 3, 4, 5].map(day => ({ spaceId: `${ORG1_ID}-space-6`, dayOfWeek: day, openTime: "08:00", closeTime: "16:00" }))),
    // Recreational Floor: Mon-Sat 7am-9pm
    ...([1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG1_ID}-space-7`, dayOfWeek: day, openTime: "07:00", closeTime: "21:00" }))),
    // Org2 - Basketball Court A: Mon-Sun 6am-10pm
    ...([0, 1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG2_ID}-space-1`, dayOfWeek: day, openTime: "06:00", closeTime: "22:00" }))),
    // Basketball Court B: Mon-Sun 6am-10pm
    ...([0, 1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG2_ID}-space-2`, dayOfWeek: day, openTime: "06:00", closeTime: "22:00" }))),
    // Soccer Field: Mon-Sun 7am-8pm
    ...([0, 1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG2_ID}-space-3`, dayOfWeek: day, openTime: "07:00", closeTime: "20:00" }))),
    // Swimming Pool: Mon-Sat 6am-9pm
    ...([1, 2, 3, 4, 5, 6].map(day => ({ spaceId: `${ORG2_ID}-space-4`, dayOfWeek: day, openTime: "06:00", closeTime: "21:00" }))),
  ];
  for (const slot of spaceAvailabilityData) {
    await prisma.spaceAvailability.upsert({
      where: {
        spaceId_dayOfWeek: {
          spaceId: slot.spaceId,
          dayOfWeek: slot.dayOfWeek,
        },
      },
      update: { openTime: slot.openTime, closeTime: slot.closeTime },
      create: slot,
    });
  }
  console.log(`  ✓ Created ${spaceAvailabilityData.length} availability slots`);

  // ============================================
  // EQUIPMENT
  // ============================================
  console.log("\n🎯 Creating equipment...");
  const equipmentData = [
    // Org1 Main Facility Equipment
    { id: `${ORG1_ID}-equip-1`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-1`, name: "Spring Floor A", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(30) },
    { id: `${ORG1_ID}-equip-2`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-2`, name: "Vault Table (Tac/10)", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(15) },
    { id: `${ORG1_ID}-equip-3`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-3`, name: "Uneven Bars Set 1", condition: "FAIR" as const, status: "MAINTENANCE" as const, lastInspectionDate: daysAgo(60) },
    { id: `${ORG1_ID}-equip-4`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-4`, name: "High Beam 1", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(45) },
    { id: `${ORG1_ID}-equip-5`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-4`, name: "High Beam 2", condition: "POOR" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(90) },
    { id: `${ORG1_ID}-equip-6`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-5`, name: "Tumble Track", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG1_ID}-equip-7`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-2`, name: "Landing Mat (Blue)", condition: "FAIR" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(40) },
    { id: `${ORG1_ID}-equip-8`, organizationId: ORG1_ID, facilityId: org1Facility1.id, spaceId: `${ORG1_ID}-space-4`, name: "Low Beam Training", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(25) },
    // Org1 Satellite Equipment
    { id: `${ORG1_ID}-equip-9`, organizationId: ORG1_ID, facilityId: org1Facility2.id, spaceId: `${ORG1_ID}-space-6`, name: "Preschool Foam Shapes", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(10) },
    { id: `${ORG1_ID}-equip-10`, organizationId: ORG1_ID, facilityId: org1Facility2.id, spaceId: `${ORG1_ID}-space-7`, name: "Panel Mat Set", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(35) },
    // Org2 Equipment
    { id: `${ORG2_ID}-equip-1`, organizationId: ORG2_ID, facilityId: org2Facility.id, spaceId: `${ORG2_ID}-space-1`, name: "Basketball Hoop A", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG2_ID}-equip-2`, organizationId: ORG2_ID, facilityId: org2Facility.id, spaceId: `${ORG2_ID}-space-2`, name: "Basketball Hoop B", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(20) },
    { id: `${ORG2_ID}-equip-3`, organizationId: ORG2_ID, facilityId: org2Facility.id, spaceId: `${ORG2_ID}-space-3`, name: "Soccer Goals (Pair)", condition: "EXCELLENT" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(7) },
    { id: `${ORG2_ID}-equip-4`, organizationId: ORG2_ID, facilityId: org2Facility.id, spaceId: `${ORG2_ID}-space-4`, name: "Lane Dividers", condition: "GOOD" as const, status: "ACTIVE" as const, lastInspectionDate: daysAgo(14) },
    { id: `${ORG2_ID}-equip-5`, organizationId: ORG2_ID, facilityId: org2Facility.id, spaceId: `${ORG2_ID}-space-5`, name: "Treadmills (Set of 5)", condition: "FAIR" as const, status: "MAINTENANCE" as const, lastInspectionDate: daysAgo(60) },
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
  // FACILITY OPERATING HOURS
  // ============================================
  console.log("\n🕐 Creating facility operating hours...");
  const operatingHoursData = [
    // Org1 Main Gym: Mon-Fri 6:00-21:00, Sat 8:00-18:00, Sun closed
    ...[1, 2, 3, 4, 5].map((day, i) => ({ id: `${ORG1_ID}-hours-main-${i}`, facilityId: org1Facility1.id, dayOfWeek: day, openTime: "06:00", closeTime: "21:00" })),
    { id: `${ORG1_ID}-hours-main-sat`, facilityId: org1Facility1.id, dayOfWeek: 6, openTime: "08:00", closeTime: "18:00" },
    // Org1 Satellite: Mon-Fri 9:00-12:00 and 14:00-20:00 (closed for lunch), Sat 9:00-14:00
    ...[1, 2, 3, 4, 5].flatMap((day) => [
      { id: `${ORG1_ID}-hours-sat-${day}a`, facilityId: org1Facility2.id, dayOfWeek: day, openTime: "09:00", closeTime: "12:00" },
      { id: `${ORG1_ID}-hours-sat-${day}b`, facilityId: org1Facility2.id, dayOfWeek: day, openTime: "14:00", closeTime: "20:00" },
    ]),
    { id: `${ORG1_ID}-hours-sat-sat`, facilityId: org1Facility2.id, dayOfWeek: 6, openTime: "09:00", closeTime: "14:00" },
    // Org2 Main: Mon-Sat 7:00-22:00, Sun 10:00-18:00
    ...[1, 2, 3, 4, 5, 6].map((day, i) => ({ id: `${ORG2_ID}-hours-main-${i}`, facilityId: org2Facility.id, dayOfWeek: day, openTime: "07:00", closeTime: "22:00" })),
    { id: `${ORG2_ID}-hours-main-sun`, facilityId: org2Facility.id, dayOfWeek: 0, openTime: "10:00", closeTime: "18:00" },
  ];
  await Promise.all(operatingHoursData.map((h) =>
    prisma.facilityOperatingHours.upsert({
      where: { id: h.id },
      update: {},
      create: h,
    })
  ));
  console.log(`  ✓ Created ${operatingHoursData.length} facility operating hours entries`);

  // ============================================
  // FACILITY NOTES
  // ============================================
  console.log("\n📝 Creating facility notes...");
  const facilityNoteData = [
    { id: `${ORG1_ID}-fnote-1`, facilityId: org1Facility1.id, authorId: org1Admin.id, content: "Annual fire inspection passed. Next inspection due March 2027.", createdAt: daysAgo(14) },
    { id: `${ORG1_ID}-fnote-2`, facilityId: org1Facility1.id, authorId: org1Coach1.id, content: "Foam pit needs refilling — ordered new foam blocks, expected delivery next week.", createdAt: daysAgo(7) },
    { id: `${ORG1_ID}-fnote-3`, facilityId: org1Facility1.id, authorId: org1Admin.id, content: "HVAC serviced — new filters installed, AC running much cooler now.", createdAt: daysAgo(3) },
    { id: `${ORG1_ID}-fnote-4`, facilityId: org1Facility2.id, authorId: org1Coach1.id, content: "Preschool area mats replaced with new anti-slip versions.", createdAt: daysAgo(21) },
    { id: `${ORG1_ID}-fnote-5`, facilityId: org1Facility2.id, authorId: org1Admin.id, content: "Parking lot repaving scheduled for the first weekend of next month. Classes will need to use the rear entrance.", createdAt: daysAgo(5) },
    { id: `${ORG2_ID}-fnote-1`, facilityId: org2Facility.id, authorId: org2Admin.id, content: "Pool chemical balance checked and adjusted. Chlorine levels back to normal.", createdAt: daysAgo(10) },
    { id: `${ORG2_ID}-fnote-2`, facilityId: org2Facility.id, authorId: org2Coach.id, content: "Basketball Court A floor refinished. Looks great — no slipping issues reported since.", createdAt: daysAgo(4) },
    { id: `${ORG2_ID}-fnote-3`, facilityId: org2Facility.id, authorId: org2Admin.id, content: "Emergency exit signs replaced with LED versions across the entire facility.", createdAt: daysAgo(1) },
  ];
  await Promise.all(facilityNoteData.map((n) =>
    prisma.facilityNote.upsert({
      where: { id: n.id },
      update: {},
      create: n,
    })
  ));
  console.log(`  ✓ Created ${facilityNoteData.length} facility notes`);

  // ============================================
  // GUARDIAN / PARENT USERS
  // ============================================
  console.log("\n👨‍👩‍👧‍👦 Creating guardian users...");
  const org1Parent1 = await prisma.user.upsert({ where: { email: "michelle.anderson@email.com" }, update: {}, create: { id: `${ORG1_ID}-parent-1`, email: "michelle.anderson@email.com", name: "Michelle Anderson", passwordHash: null, phone: "(555) 101-1001", role: "PARENT", status: "ACTIVE", balance: 0 } });
  const org1Parent2 = await prisma.user.upsert({ where: { email: "thomas.baker@email.com" }, update: {}, create: { id: `${ORG1_ID}-parent-2`, email: "thomas.baker@email.com", name: "Thomas Baker", passwordHash: null, phone: "(555) 102-1002", role: "PARENT", status: "ACTIVE", balance: 150.00 } });
  const org1Parent3 = await prisma.user.upsert({ where: { email: "lisa.chen@email.com" }, update: {}, create: { id: `${ORG1_ID}-parent-3`, email: "lisa.chen@email.com", name: "Lisa Chen", passwordHash: null, phone: "(555) 103-1003", role: "PARENT", status: "ACTIVE", balance: -25.00 } });
  const org1Parent4 = await prisma.user.upsert({ where: { email: "marcus.davis@email.com" }, update: {}, create: { id: `${ORG1_ID}-parent-4`, email: "marcus.davis@email.com", name: "Marcus Davis", passwordHash: null, phone: "(555) 104-1004", role: "PARENT", status: "ACTIVE", balance: 0 } });
  const org1Parent5 = await prisma.user.upsert({ where: { email: "nancy.evans@email.com" }, update: {}, create: { id: `${ORG1_ID}-parent-5`, email: "nancy.evans@email.com", name: "Nancy Evans", passwordHash: null, phone: "(555) 105-1005", role: "PARENT", status: "ACTIVE", balance: 75.50 } });
  const org2Parent1 = await prisma.user.upsert({ where: { email: "karen.foster@email.com" }, update: {}, create: { id: `${ORG2_ID}-parent-1`, email: "karen.foster@email.com", name: "Karen Foster", passwordHash: null, phone: "(555) 201-2001", role: "PARENT", status: "ACTIVE", balance: 0 } });
  const org2Parent2 = await prisma.user.upsert({ where: { email: "carlos.garcia@email.com" }, update: {}, create: { id: `${ORG2_ID}-parent-2`, email: "carlos.garcia@email.com", name: "Carlos Garcia", passwordHash: null, phone: "(555) 202-2002", role: "PARENT", status: "ACTIVE", balance: 200.00 } });
  const org2Parent3 = await prisma.user.upsert({ where: { email: "patricia.harris@email.com" }, update: {}, create: { id: `${ORG2_ID}-parent-3`, email: "patricia.harris@email.com", name: "Patricia Harris", passwordHash: null, phone: "(555) 203-2003", role: "PARENT", status: "ACTIVE", balance: 0 } });
  const org2Parent4 = await prisma.user.upsert({ where: { email: "john.irving@email.com" }, update: {}, create: { id: `${ORG2_ID}-parent-4`, email: "john.irving@email.com", name: "John Irving", passwordHash: null, phone: "(555) 204-2004", role: "PARENT", status: "ACTIVE", balance: -50.00 } });
  console.log("  ✓ Created 9 guardian users");

  // ============================================
  // ATHLETES
  // ============================================
  console.log("\n🏃 Creating athletes...");
  await Promise.all([
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-1` }, update: {}, create: { id: `${ORG1_ID}-ath-1`, firstName: "Emily", lastName: "Anderson", name: "Emily Anderson", email: "emily.a@email.com", birthDate: noonUTC("2016-03-15"), gender: "FEMALE", medicalDetails: { allergies: ["peanuts"], conditions: [], emergencyContact: { name: "Michelle Anderson", phone: "(555) 101-1001" } } } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-2` }, update: {}, create: { id: `${ORG1_ID}-ath-2`, firstName: "Sophie", lastName: "Anderson", name: "Sophie Anderson", email: "sophie.a@email.com", birthDate: noonUTC("2014-07-22"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-3` }, update: {}, create: { id: `${ORG1_ID}-ath-3`, firstName: "Olivia", lastName: "Baker", name: "Olivia Baker", birthDate: noonUTC("2013-11-08"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-4` }, update: {}, create: { id: `${ORG1_ID}-ath-4`, firstName: "Lily", lastName: "Chen", name: "Lily Chen", birthDate: noonUTC("2017-01-30"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-5` }, update: {}, create: { id: `${ORG1_ID}-ath-5`, firstName: "Mia", lastName: "Chen", name: "Mia Chen", birthDate: noonUTC("2012-09-14"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-6` }, update: {}, create: { id: `${ORG1_ID}-ath-6`, firstName: "Grace", lastName: "Davis", name: "Grace Davis", birthDate: noonUTC("2011-05-20"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-7` }, update: {}, create: { id: `${ORG1_ID}-ath-7`, firstName: "Ava", lastName: "Evans", name: "Ava Evans", birthDate: noonUTC("2015-12-03"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG1_ID}-ath-8` }, update: {}, create: { id: `${ORG1_ID}-ath-8`, firstName: "Hannah", lastName: "Evans", name: "Hannah Evans", birthDate: noonUTC("2019-08-11"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-1` }, update: {}, create: { id: `${ORG2_ID}-ath-1`, firstName: "Jake", lastName: "Foster", name: "Jake Foster", email: "jake.f@email.com", birthDate: noonUTC("2014-04-18"), gender: "MALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-2` }, update: {}, create: { id: `${ORG2_ID}-ath-2`, firstName: "Ethan", lastName: "Foster", name: "Ethan Foster", birthDate: noonUTC("2010-10-25"), gender: "MALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-3` }, update: {}, create: { id: `${ORG2_ID}-ath-3`, firstName: "Sofia", lastName: "Garcia", name: "Sofia Garcia", birthDate: noonUTC("2016-06-12"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-4` }, update: {}, create: { id: `${ORG2_ID}-ath-4`, firstName: "Lucas", lastName: "Garcia", name: "Lucas Garcia", birthDate: noonUTC("2011-02-28"), gender: "MALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-5` }, update: {}, create: { id: `${ORG2_ID}-ath-5`, firstName: "Chloe", lastName: "Harris", name: "Chloe Harris", birthDate: noonUTC("2015-09-07"), gender: "FEMALE" } }),
    prisma.athlete.upsert({ where: { id: `${ORG2_ID}-ath-6` }, update: {}, create: { id: `${ORG2_ID}-ath-6`, firstName: "Noah", lastName: "Irving", name: "Noah Irving", birthDate: noonUTC("2012-11-19"), gender: "MALE" } }),
  ]);
  console.log("  ✓ Created 14 athletes");

  // ============================================
  // ORGANIZATION-ATHLETE LINKS (with org-specific level, status, customId)
  // ============================================
  console.log("\n🔗 Creating organization-athlete links...");
  const orgAthleteData = [
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-1`, level: "Bronze", status: "ACTIVE" as const, customId: "SGA-001" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-2`, level: "Silver", status: "ACTIVE" as const, customId: "SGA-002" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-3`, level: "Competitive", status: "ACTIVE" as const, customId: "SGA-003" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-4`, level: "Bronze", status: "ACTIVE" as const, customId: "SGA-004" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-5`, level: "Gold", status: "ACTIVE" as const, customId: "SGA-005" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-6`, level: "Competitive", status: "ACTIVE" as const, customId: "SGA-006" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-7`, level: "Silver", status: "TRIAL" as const, customId: "SGA-007" },
    { organizationId: ORG1_ID, athleteId: `${ORG1_ID}-ath-8`, level: "Preschool", status: "ACTIVE" as const, customId: "SGA-008" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-1`, level: "Beginner", status: "ACTIVE" as const, customId: "MSC-001" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-2`, level: "Intermediate", status: "ACTIVE" as const, customId: "MSC-002" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-3`, level: "Beginner", status: "ACTIVE" as const, customId: "MSC-003" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-4`, level: "Advanced", status: "ACTIVE" as const, customId: "MSC-004" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-5`, level: "Beginner", status: "INACTIVE" as const, customId: "MSC-005" },
    { organizationId: ORG2_ID, athleteId: `${ORG2_ID}-ath-6`, level: "Intermediate", status: "ACTIVE" as const, customId: "MSC-006" },
  ];
  for (const oa of orgAthleteData) {
    await prisma.organizationAthlete.upsert({
      where: { organizationId_athleteId: { organizationId: oa.organizationId, athleteId: oa.athleteId } },
      update: {},
      create: oa,
    });
  }
  console.log(`  ✓ Created ${orgAthleteData.length} organization-athlete links`);

  // ============================================
  // ATHLETE GUARDIANS
  // ============================================
  console.log("\n👪 Creating athlete-guardian relationships...");
  const guardianData = [
    { athleteId: `${ORG1_ID}-ath-1`, userId: org1Parent1.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-2`, userId: org1Parent1.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-3`, userId: org1Parent2.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-4`, userId: org1Parent3.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-5`, userId: org1Parent3.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-6`, userId: org1Parent4.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-7`, userId: org1Parent5.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG1_ID}-ath-8`, userId: org1Parent5.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-1`, userId: org2Parent1.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-2`, userId: org2Parent1.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-3`, userId: org2Parent2.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-4`, userId: org2Parent2.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-5`, userId: org2Parent3.id, relationship: "Parent", isPrimary: true },
    { athleteId: `${ORG2_ID}-ath-6`, userId: org2Parent4.id, relationship: "Guardian", isPrimary: true },
  ];
  for (const g of guardianData) {
    await prisma.athleteGuardian.upsert({
      where: { athleteId_userId: { athleteId: g.athleteId, userId: g.userId } },
      update: {}, create: g,
    });
  }
  console.log(`  ✓ Created ${guardianData.length} athlete-guardian relationships`);

  // ============================================
  // PAYMENT METHODS
  // ============================================
  console.log("\n💳 Creating payment methods...");
  const paymentMethodData = [
    { id: `${ORG1_ID}-pm-1`, userId: org1Parent1.id, type: "CARD" as const, last4: "4242", expiry: "12/27", brand: "Visa", isDefault: true },
    { id: `${ORG1_ID}-pm-2`, userId: org1Parent2.id, type: "CARD" as const, last4: "5555", expiry: "08/26", brand: "Mastercard", isDefault: true },
    { id: `${ORG1_ID}-pm-3`, userId: org1Parent3.id, type: "BANK" as const, last4: "6789", expiry: null, brand: null, isDefault: true },
    { id: `${ORG1_ID}-pm-4`, userId: org1Parent4.id, type: "CARD" as const, last4: "1234", expiry: "03/28", brand: "Amex", isDefault: true },
    { id: `${ORG2_ID}-pm-1`, userId: org2Parent1.id, type: "CARD" as const, last4: "9876", expiry: "06/27", brand: "Visa", isDefault: true },
    { id: `${ORG2_ID}-pm-2`, userId: org2Parent2.id, type: "CARD" as const, last4: "3456", expiry: "11/26", brand: "Discover", isDefault: true },
  ];
  for (const pm of paymentMethodData) {
    await prisma.paymentMethod.upsert({ where: { id: pm.id }, update: {}, create: pm });
  }
  console.log(`  ✓ Created ${paymentMethodData.length} payment methods`);

  // ============================================
  // LEVELS
  // ============================================
  console.log("\n🏅 Creating levels...");
  const levelData = [
    // Org1 Levels (Gymnastics)
    { id: `${ORG1_ID}-level-preschool`, organizationId: ORG1_ID, name: "Preschool", description: "Ages 2-4, parent-child classes", order: 0, color: "#f472b6", isDefault: false },
    { id: `${ORG1_ID}-level-bronze`, organizationId: ORG1_ID, name: "Bronze", description: "Beginner recreational level", order: 1, color: "#cd7f32", isDefault: true },
    { id: `${ORG1_ID}-level-silver`, organizationId: ORG1_ID, name: "Silver", description: "Intermediate recreational level", order: 2, color: "#c0c0c0", isDefault: false },
    { id: `${ORG1_ID}-level-gold`, organizationId: ORG1_ID, name: "Gold", description: "Advanced recreational level", order: 3, color: "#ffd700", isDefault: false },
    { id: `${ORG1_ID}-level-competitive`, organizationId: ORG1_ID, name: "Competitive", description: "Competition track athletes", order: 4, color: "#8b5cf6", isDefault: false },
    // Org2 Levels (Multi-sport)
    { id: `${ORG2_ID}-level-beginner`, organizationId: ORG2_ID, name: "Beginner", description: "New to the sport", order: 0, color: "#22c55e", isDefault: true },
    { id: `${ORG2_ID}-level-intermediate`, organizationId: ORG2_ID, name: "Intermediate", description: "Some experience required", order: 1, color: "#3b82f6", isDefault: false },
    { id: `${ORG2_ID}-level-advanced`, organizationId: ORG2_ID, name: "Advanced", description: "Experienced athletes", order: 2, color: "#8b5cf6", isDefault: false },
    { id: `${ORG2_ID}-level-competitive`, organizationId: ORG2_ID, name: "Competitive", description: "Competition level", order: 3, color: "#ef4444", isDefault: false },
  ];
  for (const level of levelData) {
    await prisma.level.upsert({ where: { id: level.id }, update: {}, create: level });
  }
  console.log(`  ✓ Created ${levelData.length} levels`);

  // ============================================
  // PROGRAMS
  // ============================================
  console.log("\n📚 Creating programs...");
  await Promise.all([
    // Recurring program with all-instance registration (traditional subscription)
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-bronze` }, update: {}, create: { 
      id: `${ORG1_ID}-prog-rec-bronze`, name: "Recreational Bronze", description: "Introduction to gymnastics for beginners ages 5-7", 
      status: "ACTIVE", organizationId: ORG1_ID, color: "#cd7f32",
      pricingModel: "FLAT_RATE", basePrice: 85,
      showCoachOnSite: true,
      startDate: daysAgo(30), endDate: daysFromNow(335),
      registrationType: "ALL_INSTANCES",
      startTime: "16:00", duration: 60,
      facilityId: `${ORG1_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
      // Availability restrictions
      hasAgeRestriction: true, minAge: 5, maxAge: 7,
      hasLevelRestriction: true, hasCapacityRestriction: false, hasMembershipRestriction: false,
    }}),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-silver` }, update: {}, create: { 
      id: `${ORG1_ID}-prog-rec-silver`, name: "Recreational Silver", description: "Intermediate recreational program for ages 7-10", 
      status: "ACTIVE", organizationId: ORG1_ID, color: "#64748b",
      pricingModel: "FLAT_RATE", basePrice: 115,
      showCoachOnSite: true,
      startDate: daysAgo(30), endDate: daysFromNow(335),
      registrationType: "ALL_INSTANCES",
      startTime: "17:00", duration: 75,
      facilityId: `${ORG1_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
      // Availability restrictions: requires Bronze level, ages 7-10
      hasAgeRestriction: true, minAge: 7, maxAge: 10,
      hasLevelRestriction: true, hasCapacityRestriction: false, hasMembershipRestriction: false,
    }}),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-rec-gold` }, update: {}, create: { 
      id: `${ORG1_ID}-prog-rec-gold`, name: "Recreational Gold", description: "Advanced recreational program for ages 10+", 
      status: "ACTIVE", organizationId: ORG1_ID, color: "#f59e0b",
      pricingModel: "FLAT_RATE", basePrice: 145,
      showCoachOnSite: true,
      startDate: daysAgo(30), endDate: daysFromNow(335),
      registrationType: "ALL_INSTANCES",
      startTime: "18:30", duration: 90,
      facilityId: `${ORG1_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=TU,TH,SA",
    }}),
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-jo` }, update: {}, create: { 
      id: `${ORG1_ID}-prog-jo`, name: "Junior Olympics Team", description: "Competitive gymnastics program - Levels 4-10", 
      status: "ACTIVE", organizationId: ORG1_ID, color: "#8b5cf6",
      pricingModel: "FLAT_RATE", basePrice: 2400,
      showCoachOnSite: true,
      startDate: daysAgo(60), endDate: daysFromNow(305), capacity: 30,
      registrationType: "ALL_INSTANCES",
      startTime: "15:30", duration: 180,
      facilityId: `${ORG1_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
      // Availability restrictions: capacity limited, requires competitive level, minimum age 6
      hasAgeRestriction: true, minAge: 6, maxAge: null,
      hasLevelRestriction: true, hasCapacityRestriction: true, hasMembershipRestriction: true,
    }}),
    // Drop-in program with per-instance registration
    prisma.program.upsert({ where: { id: `${ORG1_ID}-prog-preschool` }, update: {}, create: { 
      id: `${ORG1_ID}-prog-preschool`, name: "Tiny Tumblers", description: "Parent-child gymnastics for ages 2-4", 
      status: "ACTIVE", organizationId: ORG1_ID, color: "#ec4899",
      pricingModel: "PER_SESSION", perSessionPrice: 25,
      showCoachOnSite: false,
      capacity: 12,
      startDate: daysAgo(7), endDate: daysFromNow(90),
      registrationType: "PER_INSTANCE",
      startTime: "09:30", duration: 45,
      facilityId: `${ORG1_ID}-facility-satellite`,
      rrule: "FREQ=WEEKLY;BYDAY=SA",
    }}),
    // Metro Sports programs
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-soccer` }, update: {}, create: { 
      id: `${ORG2_ID}-prog-soccer`, name: "Youth Soccer League", description: "Recreational soccer for ages 6-14", 
      status: "ACTIVE", organizationId: ORG2_ID, color: "#22c55e",
      pricingModel: "FLAT_RATE", basePrice: 175,
      showCoachOnSite: true,
      startDate: daysAgo(15), endDate: daysFromNow(90),
      registrationType: "ALL_INSTANCES",
      startTime: "10:00", duration: 90,
      facilityId: `${ORG2_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=SA",
    }}),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-basketball` }, update: {}, create: { 
      id: `${ORG2_ID}-prog-basketball`, name: "Teen Basketball", description: "Basketball skills and games for ages 12-18", 
      status: "ACTIVE", organizationId: ORG2_ID, color: "#f97316",
      pricingModel: "FLAT_RATE", basePrice: 95,
      showCoachOnSite: true,
      startDate: daysAgo(30), endDate: daysFromNow(60),
      registrationType: "ALL_INSTANCES",
      startTime: "18:00", duration: 90,
      facilityId: `${ORG2_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=TU,TH",
    }}),
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-swim` }, update: {}, create: { 
      id: `${ORG2_ID}-prog-swim`, name: "Swim Team", description: "Competitive swimming for all ages", 
      status: "ACTIVE", organizationId: ORG2_ID, color: "#06b6d4",
      pricingModel: "FLAT_RATE", basePrice: 1200,
      showCoachOnSite: true,
      startDate: daysAgo(60), endDate: daysFromNow(305), capacity: 40,
      registrationType: "ALL_INSTANCES",
      startTime: "06:00", duration: 120,
      facilityId: `${ORG2_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR,SA",
    }}),
    // Drop-in fitness with per-instance registration
    prisma.program.upsert({ where: { id: `${ORG2_ID}-prog-fitness` }, update: {}, create: { 
      id: `${ORG2_ID}-prog-fitness`, name: "Kids Fitness", description: "General fitness and movement for ages 5-10", 
      status: "ACTIVE", organizationId: ORG2_ID, color: "#ef4444",
      pricingModel: "PER_SESSION", perSessionPrice: 15,
      showCoachOnSite: false,
      capacity: 20,
      startDate: daysAgo(7), endDate: daysFromNow(60),
      registrationType: "PER_INSTANCE",
      startTime: "14:00", duration: 45,
      facilityId: `${ORG2_ID}-facility-main`,
      rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    }}),
  ]);
  console.log("  ✓ Created 9 base programs");

  // ============================================
  // PROGRAM INSTANCES
  // ============================================
  console.log("\n📅 Creating program instances...");
  
  // Helper function to generate weekly dates
  const generateWeeklyDates = (startDate: Date, endDate: Date, weekdays: number[]): Date[] => {
    const dates: Date[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      if (weekdays.includes(current.getDay())) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Helper to calculate end time
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, "0")}:${endMins.toString().padStart(2, "0")}`;
  };

  // Generate instances for select programs
  const programInstanceData: Array<{
    id: string;
    programId: string;
    organizationId: string;
    date: Date;
    startTime: string;
    endTime: string;
    facilityId: string | null;
    capacity: number | null;
    status: string;
  }> = [];

  // Recreational Bronze - Tuesday/Thursday 4:00 PM, 60 min
  const bronzeDates = generateWeeklyDates(daysAgo(30), daysFromNow(60), [2, 4]); // Tue, Thu
  bronzeDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG1_ID}-prog-rec-bronze-inst-${i}`,
      programId: `${ORG1_ID}-prog-rec-bronze`,
      organizationId: ORG1_ID,
      date,
      startTime: "16:00",
      endTime: calculateEndTime("16:00", 60),
      facilityId: `${ORG1_ID}-facility-main`,
      capacity: null,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Tiny Tumblers - Saturday 9:30 AM (per-instance drop-in)
  const tinyTumblersDates = generateWeeklyDates(daysAgo(7), daysFromNow(60), [6]); // Saturday
  tinyTumblersDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG1_ID}-prog-preschool-inst-${i}`,
      programId: `${ORG1_ID}-prog-preschool`,
      organizationId: ORG1_ID,
      date,
      startTime: "09:30",
      endTime: calculateEndTime("09:30", 45),
      facilityId: `${ORG1_ID}-facility-satellite`,
      capacity: 12,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Kids Fitness - Mon/Wed/Fri 2:00 PM (per-instance drop-in)
  const fitnessDates = generateWeeklyDates(daysAgo(7), daysFromNow(30), [1, 3, 5]); // Mon, Wed, Fri
  fitnessDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG2_ID}-prog-fitness-inst-${i}`,
      programId: `${ORG2_ID}-prog-fitness`,
      organizationId: ORG2_ID,
      date,
      startTime: "14:00",
      endTime: calculateEndTime("14:00", 45),
      facilityId: `${ORG2_ID}-facility-main`,
      capacity: 20,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Youth Soccer - Saturday 10:00 AM
  const soccerDates = generateWeeklyDates(daysAgo(14), daysFromNow(60), [6]); // Saturday
  soccerDates.forEach((date, i) => {
    programInstanceData.push({
      id: `${ORG2_ID}-prog-soccer-inst-${i}`,
      programId: `${ORG2_ID}-prog-soccer`,
      organizationId: ORG2_ID,
      date,
      startTime: "10:00",
      endTime: calculateEndTime("10:00", 90),
      facilityId: `${ORG2_ID}-facility-main`,
      capacity: null,
      status: date < new Date() ? "COMPLETED" : "SCHEDULED",
    });
  });

  // Create all instances (using createMany for efficiency, but handling potential duplicates)
  let instancesCreated = 0;
  for (const instance of programInstanceData) {
    try {
      await prisma.programInstance.upsert({
        where: { id: instance.id },
        update: {},
        create: instance as any,
      });
      instancesCreated++;
    } catch (e) {
      // Skip duplicates silently
    }
  }
  console.log(`  ✓ Created ${instancesCreated} program instances`);

  // Add sample instance registrations for drop-in programs
  console.log("  📝 Creating sample instance registrations...");
  
  // Get upcoming Tiny Tumblers and Kids Fitness instances
  const upcomingTinyTumblers = programInstanceData.filter(
    i => i.programId === `${ORG1_ID}-prog-preschool` && i.status === "SCHEDULED"
  ).slice(0, 3);
  
  const upcomingFitness = programInstanceData.filter(
    i => i.programId === `${ORG2_ID}-prog-fitness` && i.status === "SCHEDULED"
  ).slice(0, 5);

  const org1ParentIds = [org1Parent1.id, org1Parent1.id, org1Parent2.id, org1Parent3.id, org1Parent3.id, org1Parent4.id, org1Parent5.id, org1Parent5.id];
  const org2ParentIds = [org2Parent1.id, org2Parent1.id, org2Parent2.id, org2Parent2.id, org2Parent3.id, org2Parent4.id];
  const instanceRegistrations: Array<{
    id: string;
    programInstanceId: string;
    athleteId: string;
    userId: string | null;
    status: string;
  }> = [];

  // Add registrations for Tiny Tumblers
  upcomingTinyTumblers.forEach((instance, idx) => {
    // 3-5 athletes per session
    const numAthletes = 3 + (idx % 3);
    for (let a = 0; a < numAthletes; a++) {
      const athleteIndex = a + 1;
      instanceRegistrations.push({
        id: `${instance.id}-reg-${a}`,
        programInstanceId: instance.id,
        athleteId: `${ORG1_ID}-ath-${athleteIndex}`,
        userId: org1ParentIds[athleteIndex - 1] ?? org1Parent1.id,
        status: "REGISTERED",
      });
    }
  });

  // Add registrations for Kids Fitness
  upcomingFitness.forEach((instance, idx) => {
    // 5-10 athletes per session
    const numAthletes = 5 + (idx % 6);
    for (let a = 0; a < numAthletes; a++) {
      const athleteIndex = a + 1;
      instanceRegistrations.push({
        id: `${instance.id}-reg-${a}`,
        programInstanceId: instance.id,
        athleteId: `${ORG2_ID}-ath-${athleteIndex}`,
        userId: org2ParentIds[athleteIndex - 1] ?? org2Parent1.id,
        status: "REGISTERED",
      });
    }
  });

  let regsCreated = 0;
  for (const reg of instanceRegistrations) {
    try {
      await prisma.instanceRegistration.upsert({
        where: { id: reg.id },
        update: {},
        create: reg as any,
      });
      regsCreated++;
    } catch (e) {
      // Skip if athlete/user doesn't exist or duplicates
    }
  }
  console.log(`  ✓ Created ${regsCreated} instance registrations`);

  // ============================================
  // PROGRAM LEVEL REQUIREMENTS (many-to-many)
  // ============================================
  console.log("\n📊 Creating program level requirements...");
  try {
    // Silver program requires Bronze level
    await prisma.programLevelRequirement.upsert({
      where: { programId_levelId: { programId: `${ORG1_ID}-prog-rec-silver`, levelId: `${ORG1_ID}-level-bronze` } },
      update: {},
      create: {
        id: `${ORG1_ID}-levelreq-silver-bronze`,
        programId: `${ORG1_ID}-prog-rec-silver`,
        levelId: `${ORG1_ID}-level-bronze`,
      },
    });
    // JO Team requires multiple levels (any of Gold, Platinum, or Competitive)
    await Promise.all([
      prisma.programLevelRequirement.upsert({
        where: { programId_levelId: { programId: `${ORG1_ID}-prog-jo`, levelId: `${ORG1_ID}-level-gold` } },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-gold`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-gold`,
        },
      }),
      prisma.programLevelRequirement.upsert({
        where: { programId_levelId: { programId: `${ORG1_ID}-prog-jo`, levelId: `${ORG1_ID}-level-platinum` } },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-platinum`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-platinum`,
        },
      }),
      prisma.programLevelRequirement.upsert({
        where: { programId_levelId: { programId: `${ORG1_ID}-prog-jo`, levelId: `${ORG1_ID}-level-competitive` } },
        update: {},
        create: {
          id: `${ORG1_ID}-levelreq-jo-competitive`,
          programId: `${ORG1_ID}-prog-jo`,
          levelId: `${ORG1_ID}-level-competitive`,
        },
      }),
    ]);
    console.log("  ✓ Created 4 program level requirements");
  } catch (e) {
    console.log("  ⚠ Skipped program level requirements (missing dependencies)");
  }

  // ============================================
  // PROGRAM BULK DISCOUNTS
  // ============================================
  console.log("\n💰 Creating bulk discounts...");
  const bulkDiscountData = [
    // Org1 sibling discounts
    { id: `${ORG1_ID}-discount-1`, programId: `${ORG1_ID}-prog-rec-bronze`, type: "FAMILY_SIBLING" as const, minQuantity: 2, discountType: "PERCENTAGE" as const, discountValue: 10, description: "2nd child 10% off" },
    { id: `${ORG1_ID}-discount-2`, programId: `${ORG1_ID}-prog-rec-bronze`, type: "FAMILY_SIBLING" as const, minQuantity: 3, discountType: "PERCENTAGE" as const, discountValue: 15, description: "3rd child 15% off" },
    { id: `${ORG1_ID}-discount-3`, programId: `${ORG1_ID}-prog-rec-silver`, type: "FAMILY_SIBLING" as const, minQuantity: 2, discountType: "PERCENTAGE" as const, discountValue: 10, description: "Sibling discount" },
    { id: `${ORG1_ID}-discount-4`, programId: `${ORG1_ID}-prog-preschool`, type: "MULTI_SESSION" as const, minQuantity: 10, discountType: "PERCENTAGE" as const, discountValue: 15, description: "10-class pack 15% off" },
    // Org2 multi-session discounts
    { id: `${ORG2_ID}-discount-1`, programId: `${ORG2_ID}-prog-fitness`, type: "MULTI_SESSION" as const, minQuantity: 5, discountType: "FIXED_AMOUNT" as const, discountValue: 10, description: "5-session: $10 off" },
    { id: `${ORG2_ID}-discount-2`, programId: `${ORG2_ID}-prog-fitness`, type: "MULTI_SESSION" as const, minQuantity: 10, discountType: "FIXED_AMOUNT" as const, discountValue: 25, description: "10-session: $25 off" },
    { id: `${ORG2_ID}-discount-3`, programId: `${ORG2_ID}-prog-soccer`, type: "FAMILY_SIBLING" as const, minQuantity: 2, discountType: "FIXED_AMOUNT" as const, discountValue: 25, description: "2nd child $25 off" },
  ];
  for (const discount of bulkDiscountData) {
    await prisma.programBulkDiscount.upsert({ where: { id: discount.id }, update: {}, create: discount });
  }
  console.log(`  ✓ Created ${bulkDiscountData.length} bulk discounts`);

  // ============================================
  // MEMBERSHIP GROUPS & INSTANCES
  // ============================================
  console.log("\n📋 Creating membership groups and instances...");
  // Org1: Recurring annual membership with age restriction
  const org1MembershipGroup = await prisma.membershipGroup.upsert({
    where: { id: `${ORG1_ID}-mg-annual` }, update: {},
    create: {
      id: `${ORG1_ID}-mg-annual`, organizationId: ORG1_ID,
      name: "Annual Club Membership",
      description: "Required annual membership for all club athletes. Grants access to recreational and competitive programs.",
      programTypes: ["Recreational", "Competitive"],
      isRecurring: true, allowAutoRenew: true,
      defaultPrice: 75, defaultBillingInterval: "YEARLY",
      autoGenerateInstances: true, generationLeadDays: 60,
      hasAgeRestriction: true, minAge: 5, maxAge: 18,
      hasCapacityRestriction: false,
    },
  });
  // Org2: Non-recurring one-time membership (auto-instance created by API, but seed manually for deterministic IDs)
  const org2MembershipGroup = await prisma.membershipGroup.upsert({
    where: { id: `${ORG2_ID}-mg-seasonal` }, update: {},
    create: {
      id: `${ORG2_ID}-mg-seasonal`, organizationId: ORG2_ID,
      name: "Seasonal Pass",
      description: "Access to all programs for one season. Purchase once per season.",
      programTypes: ["Soccer", "Basketball", "Swimming"],
      isRecurring: true, allowAutoRenew: false,
      defaultPrice: 150, defaultBillingInterval: "SESSION",
      purchaseWindowDays: 30,
    },
  });
  await Promise.all([
    prisma.membershipInstance.upsert({ where: { id: `${ORG1_ID}-mi-2026` }, update: {}, create: { id: `${ORG1_ID}-mi-2026`, membershipGroupId: org1MembershipGroup.id, name: "2025-2026 Season", price: 75, billingInterval: "YEARLY", startDate: noonUTC("2025-09-01"), endDate: noonUTC("2026-08-31"), autoRenewDate: noonUTC("2026-07-01"), status: "ACTIVE", isAutoGenerated: false } }),
    prisma.membershipInstance.upsert({ where: { id: `${ORG2_ID}-mi-winter26` }, update: {}, create: { id: `${ORG2_ID}-mi-winter26`, membershipGroupId: org2MembershipGroup.id, name: "Winter 2026", price: 150, billingInterval: "SESSION", startDate: noonUTC("2026-01-01"), endDate: noonUTC("2026-03-31"), status: "ACTIVE", isAutoGenerated: false } }),
    prisma.membershipInstance.upsert({ where: { id: `${ORG2_ID}-mi-spring26` }, update: {}, create: { id: `${ORG2_ID}-mi-spring26`, membershipGroupId: org2MembershipGroup.id, name: "Spring 2026", price: 150, billingInterval: "SESSION", startDate: noonUTC("2026-04-01"), endDate: noonUTC("2026-06-30"), status: "DRAFT", isAutoGenerated: true } }),
  ]);
  console.log("  ✓ Created 2 membership groups and 3 instances (1 draft)");

  // ============================================
  // ATHLETE MEMBERSHIPS
  // ============================================
  console.log("\n🎟️ Creating athlete memberships...");
  const athleteMembershipData = [
    { id: `${ORG1_ID}-am-1`, athleteId: `${ORG1_ID}-ath-1`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: noonUTC("2025-09-01"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG1_ID}-am-2`, athleteId: `${ORG1_ID}-ath-2`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: noonUTC("2025-09-01"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG1_ID}-am-3`, athleteId: `${ORG1_ID}-ath-3`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: noonUTC("2025-09-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG1_ID}-am-4`, athleteId: `${ORG1_ID}-ath-4`, membershipInstanceId: `${ORG1_ID}-mi-2026`, startDate: noonUTC("2025-09-15"), status: "ACTIVE" as const, autoRenew: true },
    { id: `${ORG2_ID}-am-1`, athleteId: `${ORG2_ID}-ath-1`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: noonUTC("2026-01-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG2_ID}-am-2`, athleteId: `${ORG2_ID}-ath-2`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: noonUTC("2026-01-01"), status: "ACTIVE" as const, autoRenew: false },
    { id: `${ORG2_ID}-am-3`, athleteId: `${ORG2_ID}-ath-3`, membershipInstanceId: `${ORG2_ID}-mi-winter26`, startDate: noonUTC("2026-01-15"), status: "ACTIVE" as const, autoRenew: false },
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
    { id: `${ORG1_ID}-enr-1`, athleteId: `${ORG1_ID}-ath-1`, programId: `${ORG1_ID}-prog-rec-bronze`, userId: org1Parent1.id, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-2`, athleteId: `${ORG1_ID}-ath-2`, programId: `${ORG1_ID}-prog-rec-silver`, userId: org1Parent1.id, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-3`, athleteId: `${ORG1_ID}-ath-3`, programId: `${ORG1_ID}-prog-jo`, userId: org1Parent2.id, startDate: daysAgo(120), status: "ACTIVE" as const },
    { id: `${ORG1_ID}-enr-4`, athleteId: `${ORG1_ID}-ath-4`, programId: `${ORG1_ID}-prog-rec-bronze`, userId: org1Parent3.id, startDate: daysAgo(30), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-1`, athleteId: `${ORG2_ID}-ath-1`, programId: `${ORG2_ID}-prog-soccer`, userId: org2Parent1.id, startDate: daysAgo(30), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-2`, athleteId: `${ORG2_ID}-ath-2`, programId: `${ORG2_ID}-prog-basketball`, userId: org2Parent1.id, startDate: daysAgo(60), status: "ACTIVE" as const },
    { id: `${ORG2_ID}-enr-3`, athleteId: `${ORG2_ID}-ath-4`, programId: `${ORG2_ID}-prog-swim`, userId: org2Parent2.id, startDate: daysAgo(90), status: "ACTIVE" as const },
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
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-1` }, update: {}, create: { id: `${ORG1_ID}-evt-1`, title: "Bronze Class - Monday", color: "#cd7f32", date: today, startTime: "16:00", endTime: "17:00", type: "CLASS", programId: `${ORG1_ID}-prog-rec-bronze`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 12 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-2` }, update: {}, create: { id: `${ORG1_ID}-evt-2`, title: "Silver Class - Monday", color: "#64748b", date: today, startTime: "17:00", endTime: "18:30", type: "CLASS", programId: `${ORG1_ID}-prog-rec-silver`, coachId: org1Coach1.id, organizationId: ORG1_ID, capacity: 10 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-3` }, update: {}, create: { id: `${ORG1_ID}-evt-3`, title: "JO Team Practice", color: "#8b5cf6", date: today, startTime: "18:30", endTime: "21:00", type: "CLASS", programId: `${ORG1_ID}-prog-jo`, coachId: org1Coach2.id, organizationId: ORG1_ID, capacity: 20 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-4` }, update: {}, create: { id: `${ORG1_ID}-evt-4`, title: "JO Team Tryouts", color: "#d946ef", date: daysFromNow(45), startTime: "08:00", endTime: "12:00", type: "TRYOUT", description: "Open tryouts for the JO competitive team", programId: `${ORG1_ID}-prog-jo`, organizationId: ORG1_ID, capacity: 100 } }),
    prisma.event.upsert({ where: { id: `${ORG1_ID}-evt-5` }, update: {}, create: { id: `${ORG1_ID}-evt-5`, title: "Tumbling Skills Clinic", color: "#14b8a6", date: daysFromNow(30), startTime: "09:00", endTime: "12:00", type: "CLINIC", description: "One-day tumbling and floor skills clinic", organizationId: ORG1_ID, capacity: 40 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-1` }, update: {}, create: { id: `${ORG2_ID}-evt-1`, title: "Youth Soccer Practice", color: "#22c55e", date: today, startTime: "16:00", endTime: "17:30", type: "CLASS", programId: `${ORG2_ID}-prog-soccer`, coachId: org2Coach.id, organizationId: ORG2_ID, capacity: 24 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-2` }, update: {}, create: { id: `${ORG2_ID}-evt-2`, title: "Basketball Game Night", color: "#f97316", date: daysFromNow(2), startTime: "18:00", endTime: "20:00", type: "CLASS", programId: `${ORG2_ID}-prog-basketball`, organizationId: ORG2_ID, capacity: 20 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-3` }, update: {}, create: { id: `${ORG2_ID}-evt-3`, title: "Swim Team Tryouts", color: "#06b6d4", date: daysFromNow(14), startTime: "07:00", endTime: "11:00", type: "TRYOUT", programId: `${ORG2_ID}-prog-swim`, organizationId: ORG2_ID, capacity: 50 } }),
    prisma.event.upsert({ where: { id: `${ORG2_ID}-evt-4` }, update: {}, create: { id: `${ORG2_ID}-evt-4`, title: "Birthday Party - Johnson", color: "#eab308", date: daysFromNow(10), startTime: "14:00", endTime: "16:00", type: "PARTY", organizationId: ORG2_ID, capacity: 20 } }),
  ]);
  console.log("  ✓ Created 9 events");

  // ============================================
  // HISTORICAL EVENTS (for attendance metrics)
  // ============================================
  console.log("\n📆 Creating historical events for attendance tracking...");
  const historicalEvents: Array<{ id: string; title: string; date: Date; startTime: string; endTime: string; type: "CLASS" | "CLINIC" | "PARTY" | "TRYOUT" | "MEETING" | "OTHER"; programId: string; coachId: string; organizationId: string; capacity: number }> = [];
  
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
      { id: `${ORG2_ID}-evt-hist-swim-${week}`, title: "Swim Practice - Historical", date: weekDate, startTime: "06:00", endTime: "07:30", type: "CLASS", programId: `${ORG2_ID}-prog-swim`, coachId: org2Coach.id, organizationId: ORG2_ID, capacity: 30 },
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

  // Historical attendance - ORG2 (Swim - Athlete 4, Lucas) - mostly present
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 3 ? "LATE" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-4`, 
      eventId: `${ORG2_ID}-evt-hist-swim-${week}`, 
      status, 
      checkedIn: weekDate,
      notes: status === "LATE" ? "Traffic delay" : undefined
    });
  }

  // Historical attendance - ORG2 (Soccer - Athlete 3, Sofia) - new beginner, inconsistent
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 1 ? "ABSENT" : week === 3 ? "LATE" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-3`, 
      eventId: `${ORG2_ID}-evt-hist-soccer-${week}`, 
      status, 
      checkedIn: status !== "ABSENT" ? weekDate : undefined,
      notes: status === "ABSENT" ? "Schedule conflict" : undefined
    });
  }

  // Historical attendance - ORG2 (Basketball - Athlete 6, Noah) - good attendance
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 4 ? "EXCUSED" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG2_ID}-ath-6`, 
      eventId: `${ORG2_ID}-evt-hist-basketball-${week}`, 
      status, 
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "EXCUSED" ? "School field trip" : undefined
    });
  }

  // Historical attendance - ORG1 (Silver class - Athlete 7, Ava, trial)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week <= 2 ? "PRESENT" : "ABSENT";
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-7`, 
      eventId: `${ORG1_ID}-evt-hist-silver-${week}`, 
      status, 
      checkedIn: status === "PRESENT" ? weekDate : undefined,
      notes: status === "ABSENT" ? "Trial period ended" : undefined
    });
  }

  // Historical attendance - ORG1 (JO Team - Athlete 5, Mia, Gold level)
  for (let week = 1; week <= 4; week++) {
    const weekDate = daysAgo(week * 7);
    const status = week === 2 ? "LATE" : "PRESENT";
    attendanceData.push({ 
      athleteId: `${ORG1_ID}-ath-5`, 
      eventId: `${ORG1_ID}-evt-hist-jo-${week}`, 
      status, 
      checkedIn: weekDate,
      notes: status === "LATE" ? "Arrived 10 minutes late" : undefined
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
      id: `${ORG1_ID}-inv-1`, reference: "SGA-2026-0001", userId: org1Parent1.id, status: "PAID",
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
      id: `${ORG1_ID}-inv-2`, reference: "SGA-2026-0002", userId: org1Parent2.id, status: "SENT",
      dueDate: daysFromNow(15), subtotal: 200, tax: 18, total: 218, organizationId: ORG1_ID,
      lineItems: { create: [
        { description: "JO Team Monthly - Olivia", quantity: 1, unitPrice: 200, total: 200, programId: `${ORG1_ID}-prog-jo`, athleteId: `${ORG1_ID}-ath-3` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG1_ID}-inv-3` }, update: {},
    create: {
      id: `${ORG1_ID}-inv-3`, reference: "SGA-2026-0003", userId: org1Parent3.id, status: "OVERDUE",
      dueDate: daysAgo(10), subtotal: 85, tax: 7.65, total: 92.65, organizationId: ORG1_ID,
      lineItems: { create: [
        { description: "Bronze Monthly - Lily", quantity: 1, unitPrice: 85, total: 85, programId: `${ORG1_ID}-prog-rec-bronze`, athleteId: `${ORG1_ID}-ath-4` },
      ]},
    },
  });
  await prisma.invoice.upsert({
    where: { id: `${ORG2_ID}-inv-1` }, update: {},
    create: {
      id: `${ORG2_ID}-inv-1`, reference: "MSC-2026-0001", userId: org2Parent1.id, status: "PAID",
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
      id: `${ORG2_ID}-inv-2`, reference: "MSC-2026-0002", userId: org2Parent2.id, status: "PARTIAL",
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
    { id: `${ORG1_ID}-pay-1`, invoiceId: `${ORG1_ID}-inv-1`, userId: org1Parent1.id, amount: 218, method: "CARD" as const, status: "COMPLETED" as const, transactionId: "txn_seed_001", processedAt: daysAgo(20) },
    { id: `${ORG2_ID}-pay-1`, invoiceId: `${ORG2_ID}-inv-1`, userId: org2Parent1.id, amount: 294.30, method: "CARD" as const, status: "COMPLETED" as const, transactionId: "txn_seed_002", processedAt: daysAgo(7) },
    { id: `${ORG2_ID}-pay-2`, invoiceId: `${ORG2_ID}-inv-2`, userId: org2Parent2.id, amount: 600, method: "BANK" as const, status: "COMPLETED" as const, transactionId: "txn_seed_003", processedAt: daysAgo(3) },
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
    { id: `${ORG1_ID}-disc-1`, name: "New Member Welcome", code: "WELCOME15", type: "PERCENTAGE" as const, amount: 15, validFrom: daysAgo(90), validTo: daysFromNow(90), userScope: "NEW_USERS" as const, productScope: "ALL" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
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
    // Org1 defaults
    { id: `${ORG1_ID}-gl-def-prog`, code: "4100", description: "Program Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PROGRAM" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-event`, code: "4200", description: "Event Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "EVENT" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-comp`, code: "4300", description: "Competition Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "COMPETITION" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-memb`, code: "4400", description: "Membership Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "MEMBERSHIP" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-pass`, code: "4500", description: "Pass Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PASS" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-prod`, code: "4600", description: "Product Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PRODUCT" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-def-tax`, code: "2100", description: "Sales Tax Collected", type: "LIABILITY" as const, status: "ACTIVE" as const, isDefault: true, organizationId: ORG1_ID },
    // Org1 custom codes
    { id: `${ORG1_ID}-gl-1`, code: "SGA-4100", description: "Tuition Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-2`, code: "SGA-5100", description: "Coach Salaries", type: "EXPENSE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-gl-3`, code: "SGA-5200", description: "Equipment", type: "EXPENSE" as const, status: "ACTIVE" as const, organizationId: ORG1_ID },
    // Org2 defaults
    { id: `${ORG2_ID}-gl-def-prog`, code: "4100", description: "Program Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PROGRAM" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-event`, code: "4200", description: "Event Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "EVENT" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-comp`, code: "4300", description: "Competition Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "COMPETITION" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-memb`, code: "4400", description: "Membership Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "MEMBERSHIP" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-pass`, code: "4500", description: "Pass Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PASS" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-prod`, code: "4600", description: "Product Revenue", type: "REVENUE" as const, status: "ACTIVE" as const, isDefault: true, defaultForType: "PRODUCT" as const, organizationId: ORG2_ID },
    { id: `${ORG2_ID}-gl-def-tax`, code: "2100", description: "Sales Tax Collected", type: "LIABILITY" as const, status: "ACTIVE" as const, isDefault: true, organizationId: ORG2_ID },
    // Org2 custom codes
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
    { id: `${ORG1_ID}-le-1`, date: daysAgo(20), description: "Michelle Anderson - January tuition", glCodeId: `${ORG1_ID}-gl-1`, reference: "SGA-2026-0001", credit: 218, status: "POSTED" as const, organizationId: ORG1_ID },
    { id: `${ORG1_ID}-le-2`, date: daysAgo(15), description: "Monthly coach salary", glCodeId: `${ORG1_ID}-gl-2`, debit: 3500, status: "POSTED" as const, organizationId: ORG1_ID },
    { id: `${ORG2_ID}-le-1`, date: daysAgo(7), description: "Karen Foster - Program fees", glCodeId: `${ORG2_ID}-gl-1`, reference: "MSC-2026-0001", credit: 294.30, status: "POSTED" as const, organizationId: ORG2_ID },
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
    { id: `${ORG1_ID}-skill-1`, name: "Forward Roll", category: "Floor", level: "Bronze", minAge: 4, maxAge: 8, description: "Start standing, tuck chin to chest, push off feet, roll smoothly onto back, and stand up. Key points: tight tuck, hands push floor, smooth momentum." },
    { id: `${ORG1_ID}-skill-2`, name: "Backward Roll", category: "Floor", level: "Bronze", minAge: 4, maxAge: 8, description: "From standing, squat down, roll backward keeping chin tucked, push through hands by ears, stand up. Key points: hands by ears, push hard to clear head." },
    { id: `${ORG1_ID}-skill-3`, name: "Cartwheel", category: "Floor", level: "Bronze", minAge: 5, maxAge: 10, description: "Hand-hand-foot-foot pattern with straight legs passing through handstand position. Key points: straight legs, T-position arms, look at hands." },
    { id: `${ORG1_ID}-skill-4`, name: "Handstand", category: "Floor", level: "Silver", minAge: 5, maxAge: 10, description: "Kick up to inverted position with body in straight line from wrists to toes. Key points: tight core, shoulder shrug, look at hands." },
    { id: `${ORG1_ID}-skill-5`, name: "Bridge", category: "Floor", level: "Bronze", minAge: 4, maxAge: 8, description: "Arched position with hands and feet on floor, stomach facing ceiling. Key points: push shoulders over hands, straight arms." },
    
    // Floor - Intermediate (ages 6-10)
    { id: `${ORG1_ID}-skill-6`, name: "Round-off", category: "Floor", level: "Silver", minAge: 6, maxAge: 12, description: "Running entry, cartwheel with 1/4 turn to land with both feet together facing start direction. Key points: fast snap-down, arms by ears." },
    { id: `${ORG1_ID}-skill-7`, name: "Back Walkover", category: "Floor", level: "Silver", minAge: 6, maxAge: 12, description: "Standing back arch through bridge, split legs, and stand up one leg at a time. Key points: controlled arch back, split legs." },
    { id: `${ORG1_ID}-skill-8`, name: "Front Walkover", category: "Floor", level: "Silver", minAge: 6, maxAge: 12, description: "Standing forward through handstand with split legs, arch over to standing. Key points: strong lunge, split in handstand." },
    
    // Floor - Advanced (ages 8+)
    { id: `${ORG1_ID}-skill-9`, name: "Back Handspring", category: "Floor", level: "Gold", minAge: 8, maxAge: 18, description: "Jump backward through handstand, snap down to feet. Key points: sit back, big arm swing, tight arch." },
    { id: `${ORG1_ID}-skill-10`, name: "Front Handspring", category: "Floor", level: "Gold", minAge: 8, maxAge: 18, description: "Running hurdle to handstand with powerful push through shoulders, snap down to feet. Key points: block through shoulders, tight body." },
    
    // Vault - Beginner
    { id: `${ORG1_ID}-skill-11`, name: "Squat On", category: "Vault", level: "Bronze", minAge: 5, maxAge: 10, description: "Run to springboard, jump to squat position on vault, stand, and jump off. Key points: strong punch off board, knees to chest." },
    { id: `${ORG1_ID}-skill-12`, name: "Straddle Over", category: "Vault", level: "Bronze", minAge: 6, maxAge: 12, description: "Run, punch off board, place hands on vault and straddle legs over, land on feet. Key points: straight arms, push through shoulders." },
    
    // Vault - Intermediate/Advanced
    { id: `${ORG1_ID}-skill-13`, name: "Handspring Vault", category: "Vault", level: "Silver", minAge: 8, maxAge: 18, description: "Run, punch off board, front handspring over vault table. Key points: block through shoulders, tight body, stick landing." },
    
    // Bars - Beginner
    { id: `${ORG1_ID}-skill-14`, name: "Pullover", category: "Bars", level: "Bronze", minAge: 5, maxAge: 10, description: "From hang, pull body up and over bar to front support. Key points: pull close to bar, chin tucked, hips to bar." },
    { id: `${ORG1_ID}-skill-15`, name: "Back Hip Circle", category: "Bars", level: "Bronze", minAge: 5, maxAge: 10, description: "From front support, fall backward around bar keeping hips close. Key points: hollow body, hips stay on bar." },
    { id: `${ORG1_ID}-skill-16`, name: "Glide Swing", category: "Bars", level: "Bronze", minAge: 5, maxAge: 10, description: "From hang, extend body forward then pull legs in to swing under bar. Key points: extend legs forward, pike at end." },
    
    // Bars - Intermediate
    { id: `${ORG1_ID}-skill-17`, name: "Cast", category: "Bars", level: "Silver", minAge: 6, maxAge: 14, description: "From front support, push hips away from bar while maintaining hollow shape. Key points: push through shoulders, tight hollow body." },
    { id: `${ORG1_ID}-skill-18`, name: "Kip", category: "Bars", level: "Gold", minAge: 8, maxAge: 18, description: "From glide, bring toes to bar, then slide legs down bar while pulling to front support. Key points: toes to bar, aggressive pull." },
    
    // Beam - Beginner
    { id: `${ORG1_ID}-skill-19`, name: "Beam Walk", category: "Beam", level: "Bronze", minAge: 4, maxAge: 8, description: "Walk forward on beam with good posture, arms out for balance. Key points: eyes up, small steps, pointed toes." },
    { id: `${ORG1_ID}-skill-20`, name: "Dip Walk", category: "Beam", level: "Bronze", minAge: 4, maxAge: 8, description: "Walk with a plie (dip) on each step. Key points: deep plie, straight supporting leg, pointed toe." },
    { id: `${ORG1_ID}-skill-21`, name: "Relevé Turns", category: "Beam", level: "Bronze", minAge: 5, maxAge: 10, description: "Turn on balls of feet (relevé) with controlled rotation. Key points: high relevé, spot head, arms help balance." },
    { id: `${ORG1_ID}-skill-22`, name: "Scale", category: "Beam", level: "Bronze", minAge: 5, maxAge: 10, description: "Stand on one leg, other leg extended behind, torso parallel to beam. Key points: straight legs, square hips, arms extended." },
    
    // Beam - Intermediate
    { id: `${ORG1_ID}-skill-23`, name: "Cartwheel on Beam", category: "Beam", level: "Silver", minAge: 7, maxAge: 14, description: "Cartwheel performed on the balance beam with control. Key points: stay in line, control speed, look at hands." },
    { id: `${ORG1_ID}-skill-24`, name: "Handstand on Beam", category: "Beam", level: "Silver", minAge: 7, maxAge: 14, description: "Controlled handstand on beam with proper alignment. Key points: controlled kick, tight body, balance through shoulders." },
    
    // General/Conditioning - Beginner
    { id: `${ORG1_ID}-skill-25`, name: "Straddle Stretch", category: "General", level: "Bronze", minAge: 4, maxAge: 18, description: "Seated straddle position with chest reaching toward floor. Key points: straight legs, pointed toes, flat back." },
    { id: `${ORG1_ID}-skill-26`, name: "Pike Stretch", category: "General", level: "Bronze", minAge: 4, maxAge: 18, description: "Seated pike position reaching for toes. Key points: straight legs, flexed feet, nose to knees." },
    { id: `${ORG1_ID}-skill-27`, name: "Hollow Body Hold", category: "General", level: "Bronze", minAge: 5, maxAge: 18, description: "Lying on back with arms overhead, lift shoulders and legs off ground maintaining curved spine. Key points: lower back pressed to floor, tight core." },
    { id: `${ORG1_ID}-skill-28`, name: "Arch Body Hold", category: "General", level: "Bronze", minAge: 5, maxAge: 18, description: "Lying face down, lift arms and legs off ground in arched position. Key points: squeeze glutes, lift chest, arms by ears." },
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
    { id: `${ORG2_ID}-skill-1`, name: "Dribbling", category: "Soccer", level: "Beginner", minAge: 5, maxAge: 14, description: "Basic ball control while moving. Key points: soft touches, use both feet, keep ball close." },
    { id: `${ORG2_ID}-skill-2`, name: "Passing", category: "Soccer", level: "Beginner", minAge: 5, maxAge: 14, description: "Accurate short passes with inside of foot. Key points: plant foot beside ball, follow through toward target." },
    { id: `${ORG2_ID}-skill-3`, name: "Layup", category: "Basketball", level: "Beginner", minAge: 7, maxAge: 18, description: "Basic layup from both sides of the basket. Key points: two-step approach, knee up, soft touch on backboard." },
    { id: `${ORG2_ID}-skill-4`, name: "Freestyle Stroke", category: "Swimming", level: "Beginner", minAge: 5, maxAge: 18, description: "Proper freestyle technique with rhythmic breathing. Key points: high elbow recovery, bilateral breathing, flutter kick." },
    { id: `${ORG2_ID}-skill-5`, name: "Shooting Form", category: "Basketball", level: "Intermediate", minAge: 8, maxAge: 18, description: "Proper shooting mechanics from mid-range. Key points: BEEF - Balance, Eyes, Elbow, Follow-through." },
    { id: `${ORG2_ID}-skill-6`, name: "Backstroke", category: "Swimming", level: "Intermediate", minAge: 6, maxAge: 18, description: "Proper backstroke technique with rotation. Key points: pinky first entry, hip rotation, steady kick." },
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
      levelId: `${ORG1_ID}-level-bronze`,
      minAge: 4,
      maxAge: 5,
      organizationId: ORG1_ID,
      // New evaluation enhancement fields
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [`${ORG1_ID}-skill-1`, `${ORG1_ID}-skill-3`, `${ORG1_ID}-skill-5`, `${ORG1_ID}-skill-19`, `${ORG1_ID}-skill-25`],
    },
    {
      id: `${ORG1_ID}-template-rec-level1`,
      name: "Recreational Level 1",
      description: "Entry-level recreational assessment covering basic skills across all apparatus (ages 5-7).",
      levelId: `${ORG1_ID}-level-bronze`,
      minAge: 5,
      maxAge: 7,
      organizationId: ORG1_ID,
      // Pass/Fail scoring with 75% completion requirement
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
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
      levelId: `${ORG1_ID}-level-silver`,
      minAge: 6,
      maxAge: 9,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with pass threshold of 7
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
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
      levelId: `${ORG1_ID}-level-silver`,
      minAge: 7,
      maxAge: 10,
      organizationId: ORG1_ID,
      // All skills must pass for pre-team readiness
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
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
      levelId: `${ORG1_ID}-level-gold`,
      minAge: 8,
      maxAge: 12,
      organizationId: ORG1_ID,
      // Point scale scoring (1-10) with strict 8+ threshold and 90% completion
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 8,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 90,
      skillIds: [`${ORG1_ID}-skill-9`, `${ORG1_ID}-skill-10`, `${ORG1_ID}-skill-13`, `${ORG1_ID}-skill-18`, `${ORG1_ID}-skill-23`, `${ORG1_ID}-skill-24`],
    },
    // Org2 - Metro Sports evaluation templates
    {
      id: `${ORG2_ID}-template-soccer-skills`,
      name: "Soccer Skills Assessment",
      description: "Fundamental soccer skills evaluation covering dribbling and passing for beginner-level players.",
      levelId: `${ORG2_ID}-level-beginner`,
      minAge: 5,
      maxAge: 14,
      organizationId: ORG2_ID,
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 75,
      skillIds: [`${ORG2_ID}-skill-1`, `${ORG2_ID}-skill-2`],
    },
    {
      id: `${ORG2_ID}-template-basketball-skills`,
      name: "Basketball Skills Assessment",
      description: "Basketball fundamentals evaluation covering layups and shooting form for intermediate players.",
      levelId: `${ORG2_ID}-level-intermediate`,
      minAge: 8,
      maxAge: 18,
      organizationId: ORG2_ID,
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "POINT_SCALE" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "PERCENTAGE" as const,
      completionThreshold: 80,
      skillIds: [`${ORG2_ID}-skill-3`, `${ORG2_ID}-skill-5`],
    },
    {
      id: `${ORG2_ID}-template-swim-skills`,
      name: "Swim Skills Assessment",
      description: "Swimming technique evaluation covering freestyle and backstroke for advancing swimmers.",
      levelId: `${ORG2_ID}-level-advanced`,
      minAge: 6,
      maxAge: 18,
      organizationId: ORG2_ID,
      autoSyncEnabled: false,
      autoSyncLevels: [] as string[],
      autoSyncCategories: [] as string[],
      scoringType: "PASS_FAIL" as const,
      pointScaleMin: 1,
      pointScaleMax: 10,
      pointScalePassThreshold: 7,
      completionType: "ALL" as const,
      completionThreshold: 100,
      skillIds: [`${ORG2_ID}-skill-4`, `${ORG2_ID}-skill-6`],
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
    // Org2 - Metro Sports achievements
    {
      id: `${ORG2_ID}-achievement-soccer`,
      templateId: `${ORG2_ID}-template-soccer-skills`,
      name: "Soccer Skills Star",
      description: "Demonstrated solid soccer fundamentals in dribbling and passing. Ready for the next level!",
      badgeImageUrl: null,
      organizationId: ORG2_ID,
    },
    {
      id: `${ORG2_ID}-achievement-basketball`,
      templateId: `${ORG2_ID}-template-basketball-skills`,
      name: "Basketball Rising Star",
      description: "Showed excellent basketball skills with strong shooting form and layup technique.",
      badgeImageUrl: null,
      organizationId: ORG2_ID,
    },
    {
      id: `${ORG2_ID}-achievement-swim`,
      templateId: `${ORG2_ID}-template-swim-skills`,
      name: "Swim Team Ready",
      description: "Passed the swim skills assessment with proficiency in freestyle and backstroke. Ready for competitive swimming!",
      badgeImageUrl: null,
      organizationId: ORG2_ID,
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
    // JO program uses Pre-Team and JO Level 3 templates
    {
      id: `${ORG1_ID}-pet-jo-preteam`,
      programId: `${ORG1_ID}-prog-jo`,
      templateId: `${ORG1_ID}-template-preteam`,
      isRequired: false,
      dueDate: null,
    },
    {
      id: `${ORG1_ID}-pet-jo-jo3`,
      programId: `${ORG1_ID}-prog-jo`,
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
    // Org2 - Metro Sports program-template assignments
    {
      id: `${ORG2_ID}-pet-soccer`,
      programId: `${ORG2_ID}-prog-soccer`,
      templateId: `${ORG2_ID}-template-soccer-skills`,
      isRequired: true,
      dueDate: null,
    },
    {
      id: `${ORG2_ID}-pet-basketball`,
      programId: `${ORG2_ID}-prog-basketball`,
      templateId: `${ORG2_ID}-template-basketball-skills`,
      isRequired: true,
      dueDate: null,
    },
    {
      id: `${ORG2_ID}-pet-swim`,
      programId: `${ORG2_ID}-prog-swim`,
      templateId: `${ORG2_ID}-template-swim-skills`,
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
      levelId: `${ORG1_ID}-level-bronze`,
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
      levelId: `${ORG1_ID}-level-silver`,
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
    update: { programId: `${ORG1_ID}-prog-jo` },
    create: {
      id: `${ORG1_ID}-eval-3`,
      athleteId: `${ORG1_ID}-ath-3`,
      coachId: org1Coach2.id,
      templateId: `${ORG1_ID}-template-preteam`,
      programId: `${ORG1_ID}-prog-jo`, // Link to JO program
      date: daysAgo(45),
      levelId: `${ORG1_ID}-level-silver`,
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
      levelId: `${ORG1_ID}-level-bronze`,
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
      levelId: `${ORG1_ID}-level-preschool`,
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
  
  // Evaluation 6 - Jake (Metro, Soccer) - Completed Soccer Skills Assessment
  const eval6 = await prisma.evaluation.upsert({
    where: { id: `${ORG2_ID}-eval-1` },
    update: { programId: `${ORG2_ID}-prog-soccer` },
    create: {
      id: `${ORG2_ID}-eval-1`,
      athleteId: `${ORG2_ID}-ath-1`,
      coachId: org2Coach.id,
      templateId: `${ORG2_ID}-template-soccer-skills`,
      programId: `${ORG2_ID}-prog-soccer`,
      date: daysAgo(10),
      levelId: `${ORG2_ID}-level-beginner`,
      overallScore: 7.0,
      status: "PASS",
      notes: "Jake shows great footwork for his age. Dribbling is solid, passing accuracy improving.",
    },
  });

  const eval6Skills = [
    { skillId: `${ORG2_ID}-skill-1`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Good close control, uses both feet" },
    { skillId: `${ORG2_ID}-skill-2`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Accurate short passes, needs work on long balls" },
  ];

  for (const skill of eval6Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval6.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval6.id, ...skill },
    });
  }

  // Evaluation 7 - Ethan (Metro, Basketball) - Completed Basketball Skills (Point Scale)
  const eval7 = await prisma.evaluation.upsert({
    where: { id: `${ORG2_ID}-eval-2` },
    update: { programId: `${ORG2_ID}-prog-basketball` },
    create: {
      id: `${ORG2_ID}-eval-2`,
      athleteId: `${ORG2_ID}-ath-2`,
      coachId: org2Coach.id,
      templateId: `${ORG2_ID}-template-basketball-skills`,
      programId: `${ORG2_ID}-prog-basketball`,
      date: daysAgo(18),
      levelId: `${ORG2_ID}-level-intermediate`,
      overallScore: 8.5,
      status: "EXCELLENT",
      notes: "Ethan has excellent court awareness. Layups are consistent and shooting form is textbook.",
    },
  });

  const eval7Skills = [
    { skillId: `${ORG2_ID}-skill-3`, attemptStatus: "SUCCEEDED" as const, pointScore: 9, passed: true, comment: "Smooth layups from both sides" },
    { skillId: `${ORG2_ID}-skill-5`, attemptStatus: "SUCCEEDED" as const, pointScore: 8, passed: true, comment: "Great BEEF form, consistent from mid-range" },
  ];

  for (const skill of eval7Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval7.id, skillId: skill.skillId } },
      update: { passed: skill.passed, pointScore: skill.pointScore },
      create: { evaluationId: eval7.id, ...skill },
    });
  }

  // Evaluation 8 - Lucas (Metro, Swim) - Completed Swim Skills Assessment
  const eval8 = await prisma.evaluation.upsert({
    where: { id: `${ORG2_ID}-eval-3` },
    update: { programId: `${ORG2_ID}-prog-swim` },
    create: {
      id: `${ORG2_ID}-eval-3`,
      athleteId: `${ORG2_ID}-ath-4`,
      coachId: org2Coach.id,
      templateId: `${ORG2_ID}-template-swim-skills`,
      programId: `${ORG2_ID}-prog-swim`,
      date: daysAgo(25),
      levelId: `${ORG2_ID}-level-advanced`,
      overallScore: 8.0,
      status: "PASS",
      notes: "Lucas has strong stroke technique. Ready for competitive meets.",
    },
  });

  const eval8Skills = [
    { skillId: `${ORG2_ID}-skill-4`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Excellent bilateral breathing and high elbow recovery" },
    { skillId: `${ORG2_ID}-skill-6`, attemptStatus: "SUCCEEDED" as const, passed: true, comment: "Good hip rotation and steady kick" },
  ];

  for (const skill of eval8Skills) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval8.id, skillId: skill.skillId } },
      update: { passed: skill.passed },
      create: { evaluationId: eval8.id, ...skill },
    });
  }

  // Evaluation 9 - Noah (Metro, Basketball) - Pending Basketball Skills Assessment
  const eval9 = await prisma.evaluation.upsert({
    where: { id: `${ORG2_ID}-eval-4` },
    update: { programId: `${ORG2_ID}-prog-basketball` },
    create: {
      id: `${ORG2_ID}-eval-4`,
      athleteId: `${ORG2_ID}-ath-6`,
      coachId: org2Coach.id,
      templateId: `${ORG2_ID}-template-basketball-skills`,
      programId: `${ORG2_ID}-prog-basketball`,
      date: daysFromNow(5),
      levelId: `${ORG2_ID}-level-intermediate`,
      overallScore: 0,
      status: "PENDING",
      notes: null,
    },
  });

  const eval9SkillIds = [`${ORG2_ID}-skill-3`, `${ORG2_ID}-skill-5`];
  for (const skillId of eval9SkillIds) {
    await prisma.evaluationSkill.upsert({
      where: { evaluationId_skillId: { evaluationId: eval9.id, skillId } },
      update: { passed: false },
      create: { evaluationId: eval9.id, skillId, attemptStatus: "NOT_ATTEMPTED", passed: false },
    });
  }

  console.log("  ✓ Created 9 evaluations with skill ratings (5 Sunrise + 4 Metro)");

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
    // Metro Sports athlete achievements
    {
      id: `${ORG2_ID}-athlete-ach-1`,
      athleteId: `${ORG2_ID}-ath-1`,
      achievementId: `${ORG2_ID}-achievement-soccer`,
      evaluationId: eval6.id,
      earnedAt: daysAgo(10),
      bestResultsByCategory: { "Soccer": 100 },
      overallScore: 7.0,
    },
    {
      id: `${ORG2_ID}-athlete-ach-2`,
      athleteId: `${ORG2_ID}-ath-2`,
      achievementId: `${ORG2_ID}-achievement-basketball`,
      evaluationId: eval7.id,
      earnedAt: daysAgo(18),
      bestResultsByCategory: { "Basketball": 8.5 },
      overallScore: 8.5,
    },
    {
      id: `${ORG2_ID}-athlete-ach-3`,
      athleteId: `${ORG2_ID}-ath-4`,
      achievementId: `${ORG2_ID}-achievement-swim`,
      evaluationId: eval8.id,
      earnedAt: daysAgo(25),
      bestResultsByCategory: { "Swimming": 100 },
      overallScore: 8.0,
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

  // Jake's skill progress (Metro - Soccer)
  const jakeProgress = [
    { athleteId: `${ORG2_ID}-ath-1`, skillId: `${ORG2_ID}-skill-1`, bestStatus: "SUCCEEDED" as const, attemptCount: 3, successCount: 2, firstAttemptedAt: daysAgo(40), firstSucceededAt: daysAgo(20), lastEvaluatedAt: daysAgo(10) },
    { athleteId: `${ORG2_ID}-ath-1`, skillId: `${ORG2_ID}-skill-2`, bestStatus: "SUCCEEDED" as const, attemptCount: 4, successCount: 2, firstAttemptedAt: daysAgo(35), firstSucceededAt: daysAgo(10), lastEvaluatedAt: daysAgo(10) },
  ];

  for (const progress of jakeProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }

  // Ethan's skill progress (Metro - Basketball)
  const ethanProgress = [
    { athleteId: `${ORG2_ID}-ath-2`, skillId: `${ORG2_ID}-skill-3`, bestStatus: "SUCCEEDED" as const, attemptCount: 5, successCount: 4, firstAttemptedAt: daysAgo(60), firstSucceededAt: daysAgo(30), lastEvaluatedAt: daysAgo(18) },
    { athleteId: `${ORG2_ID}-ath-2`, skillId: `${ORG2_ID}-skill-5`, bestStatus: "SUCCEEDED" as const, attemptCount: 6, successCount: 3, firstAttemptedAt: daysAgo(55), firstSucceededAt: daysAgo(18), lastEvaluatedAt: daysAgo(18) },
  ];

  for (const progress of ethanProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }

  // Lucas's skill progress (Metro - Swimming)
  const lucasProgress = [
    { athleteId: `${ORG2_ID}-ath-4`, skillId: `${ORG2_ID}-skill-4`, bestStatus: "SUCCEEDED" as const, attemptCount: 4, successCount: 3, firstAttemptedAt: daysAgo(80), firstSucceededAt: daysAgo(40), lastEvaluatedAt: daysAgo(25) },
    { athleteId: `${ORG2_ID}-ath-4`, skillId: `${ORG2_ID}-skill-6`, bestStatus: "SUCCEEDED" as const, attemptCount: 5, successCount: 3, firstAttemptedAt: daysAgo(70), firstSucceededAt: daysAgo(25), lastEvaluatedAt: daysAgo(25) },
  ];

  for (const progress of lucasProgress) {
    await prisma.athleteSkillProgress.upsert({
      where: { athleteId_skillId: { athleteId: progress.athleteId, skillId: progress.skillId } },
      update: {},
      create: { id: `${progress.athleteId}-progress-${progress.skillId}`, ...progress },
    });
  }
  
  console.log(`  ✓ Created ${emilyProgress.length + sophieProgress.length + jakeProgress.length + ethanProgress.length + lucasProgress.length} athlete skill progress records`);

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
  // MEMBER EMPLOYMENT DATA
  // ============================================
  console.log("\n👷 Updating members with employment data...");
  const employmentUpdates = [
    {
      memberId: `${ORG1_ID}-staff-1`,
      data: {
        employmentType: "FULL_TIME" as const,
        title: "Head Coach",
        hourlyRate: 35.00,
        hireDate: daysAgo(365),
        phone: "(555) 111-2222",
        emergencyContact: { name: "John Rodriguez", phone: "(555) 111-3333", relationship: "Spouse" },
      },
    },
    {
      memberId: `${ORG1_ID}-staff-2`,
      data: {
        employmentType: "FULL_TIME" as const,
        title: "JO Team Coach",
        hourlyRate: 32.00,
        hireDate: daysAgo(180),
        phone: "(555) 111-4444",
        emergencyContact: { name: "Lisa Chen", phone: "(555) 111-5555", relationship: "Parent" },
      },
    },
    {
      memberId: `${ORG1_ID}-staff-3`,
      data: {
        employmentType: "PART_TIME" as const,
        title: "Finance & Admin",
        hourlyRate: 25.00,
        hireDate: daysAgo(90),
        phone: "(555) 111-6666",
        emergencyContact: Prisma.DbNull,
      },
    },
    {
      memberId: `${ORG2_ID}-staff-1`,
      data: {
        employmentType: "FULL_TIME" as const,
        title: "Multi-Sport Coach",
        hourlyRate: 28.00,
        hireDate: daysAgo(200),
        phone: "(555) 222-1111",
        emergencyContact: { name: "Carlos Martinez", phone: "(555) 222-2222", relationship: "Spouse" },
      },
    },
    {
      memberId: `${ORG2_ID}-staff-2`,
      data: {
        employmentType: "VOLUNTEER" as const,
        title: "Assistant Coach",
        hourlyRate: null,
        hireDate: daysAgo(60),
        phone: "(555) 222-3333",
        emergencyContact: Prisma.DbNull,
      },
    },
  ];
  for (const emp of employmentUpdates) {
    await prisma.organizationMember.update({ where: { id: emp.memberId }, data: emp.data });
  }
  console.log(`  ✓ Updated ${employmentUpdates.length} members with employment data`);

  // ============================================
  // CERTIFICATION DEFINITIONS & MEMBER CERTIFICATIONS
  // ============================================
  console.log("\n🏅 Creating certifications...");

  const certDefs = [
    { id: `${ORG1_ID}-cert-usag`, orgId: ORG1_ID, name: "USAG Safety Certification", criteria: "Complete USAG Safety & Risk Management course", renewalPeriodMonths: 12 },
    { id: `${ORG1_ID}-cert-cpr`, orgId: ORG1_ID, name: "CPR / First Aid", criteria: "Complete ARC CPR/First Aid course and pass practical exam", renewalPeriodMonths: 24 },
    { id: `${ORG1_ID}-cert-safesport`, orgId: ORG1_ID, name: "SafeSport Trained", criteria: "Complete U.S. Center for SafeSport training", renewalPeriodMonths: 12 },
    { id: `${ORG1_ID}-cert-bgcheck`, orgId: ORG1_ID, name: "Background Check Cleared", criteria: "Pass national background check", renewalPeriodMonths: null },
    { id: `${ORG2_ID}-cert-cpr`, orgId: ORG2_ID, name: "CPR / First Aid", criteria: "Complete ARC CPR/First Aid course and pass practical exam", renewalPeriodMonths: 24 },
    { id: `${ORG2_ID}-cert-safesport`, orgId: ORG2_ID, name: "SafeSport Trained", criteria: "Complete U.S. Center for SafeSport training", renewalPeriodMonths: 12 },
    { id: `${ORG2_ID}-cert-bgcheck`, orgId: ORG2_ID, name: "Background Check Cleared", criteria: "Pass national background check", renewalPeriodMonths: null },
  ];

  for (const cd of certDefs) {
    await prisma.certification.upsert({
      where: { id: cd.id },
      update: {},
      create: {
        id: cd.id,
        organizationId: cd.orgId,
        name: cd.name,
        criteria: cd.criteria,
        evaluationMethod: "PASS_FAIL",
        renewalPeriodMonths: cd.renewalPeriodMonths,
        requiredForPrograms: true,
        requiredForEvents: true,
        isActive: true,
      },
    });
  }
  console.log(`  ✓ Created ${certDefs.length} certification definitions`);

  const memberCerts = [
    // Org1 staff-1 (Head Coach): USAG, CPR, SafeSport
    { certId: `${ORG1_ID}-cert-usag`, memberId: `${ORG1_ID}-staff-1`, grantedAt: daysAgo(90), expiresAt: daysFromNow(180) },
    { certId: `${ORG1_ID}-cert-cpr`, memberId: `${ORG1_ID}-staff-1`, grantedAt: daysAgo(90), expiresAt: daysFromNow(365) },
    { certId: `${ORG1_ID}-cert-safesport`, memberId: `${ORG1_ID}-staff-1`, grantedAt: daysAgo(90), expiresAt: daysFromNow(730) },
    // Org1 staff-2 (JO Team Coach): USAG, SafeSport
    { certId: `${ORG1_ID}-cert-usag`, memberId: `${ORG1_ID}-staff-2`, grantedAt: daysAgo(60), expiresAt: daysFromNow(300) },
    { certId: `${ORG1_ID}-cert-safesport`, memberId: `${ORG1_ID}-staff-2`, grantedAt: daysAgo(60), expiresAt: daysFromNow(500) },
    // Org1 staff-3 (Finance): Background Check (no expiry)
    { certId: `${ORG1_ID}-cert-bgcheck`, memberId: `${ORG1_ID}-staff-3`, grantedAt: daysAgo(90), expiresAt: null },
    // Org2 staff-1 (Multi-Sport Coach): CPR, SafeSport
    { certId: `${ORG2_ID}-cert-cpr`, memberId: `${ORG2_ID}-staff-1`, grantedAt: daysAgo(60), expiresAt: daysFromNow(200) },
    { certId: `${ORG2_ID}-cert-safesport`, memberId: `${ORG2_ID}-staff-1`, grantedAt: daysAgo(60), expiresAt: daysFromNow(400) },
    // Org2 staff-2 (Assistant Coach): Background Check (no expiry)
    { certId: `${ORG2_ID}-cert-bgcheck`, memberId: `${ORG2_ID}-staff-2`, grantedAt: daysAgo(60), expiresAt: null },
  ];

  for (const mc of memberCerts) {
    await prisma.memberCertification.upsert({
      where: { certificationId_memberId: { certificationId: mc.certId, memberId: mc.memberId } },
      update: {},
      create: {
        certificationId: mc.certId,
        memberId: mc.memberId,
        passed: true,
        grantedAt: mc.grantedAt,
        expiresAt: mc.expiresAt,
      },
    });
  }
  console.log(`  ✓ Created ${memberCerts.length} member certifications`);

  // ============================================
  // MEMBER AVAILABILITY
  // ============================================
  console.log("\n📅 Creating member availability...");
  const availabilityData = [
    // Org1 Coach 1 - Available weekdays 8am-6pm
    { memberId: `${ORG1_ID}-staff-1`, dayOfWeek: 1, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-1`, dayOfWeek: 2, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-1`, dayOfWeek: 3, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-1`, dayOfWeek: 4, startTime: "08:00", endTime: "18:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-1`, dayOfWeek: 5, startTime: "08:00", endTime: "18:00", isAvailable: true },
    // Org1 Coach 2 - Afternoons and evenings
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 1, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 2, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 3, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 4, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 5, startTime: "14:00", endTime: "21:00", isAvailable: true },
    { memberId: `${ORG1_ID}-staff-2`, dayOfWeek: 6, startTime: "09:00", endTime: "14:00", isAvailable: true },
    // Org2 Coach - Full availability
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 4, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isAvailable: true },
    { memberId: `${ORG2_ID}-staff-1`, dayOfWeek: 6, startTime: "10:00", endTime: "15:00", isAvailable: true },
  ];
  for (const avail of availabilityData) {
    await prisma.memberAvailability.upsert({
      where: { memberId_dayOfWeek: { memberId: avail.memberId, dayOfWeek: avail.dayOfWeek } },
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
    { id: `${ORG1_ID}-shift-1`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: today, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "IN_PROGRESS" as const },
    { id: `${ORG1_ID}-shift-2`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: today, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-3`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: daysFromNow(1), startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-4`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: daysFromNow(1), startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "SCHEDULED" as const },
    { id: `${ORG1_ID}-shift-5`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-3`, facilityId: org1Facility1.id, date: daysFromNow(2), startTime: "09:00", endTime: "14:00", shiftType: "Front Desk", status: "SCHEDULED" as const },
    // Historical shifts (completed)
    { id: `${ORG1_ID}-shift-6`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id, date: daysAgo(1), startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", status: "COMPLETED" as const },
    { id: `${ORG1_ID}-shift-7`, organizationId: ORG1_ID, memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id, date: daysAgo(1), startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", status: "COMPLETED" as const },
    // Org2 shifts
    { id: `${ORG2_ID}-shift-1`, organizationId: ORG2_ID, memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id, date: today, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", status: "IN_PROGRESS" as const },
    { id: `${ORG2_ID}-shift-2`, organizationId: ORG2_ID, memberId: `${ORG2_ID}-staff-2`, facilityId: org2Facility.id, date: today, startTime: "14:00", endTime: "18:00", shiftType: "Assistant Coach", status: "SCHEDULED" as const },
    { id: `${ORG2_ID}-shift-3`, organizationId: ORG2_ID, memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id, date: daysFromNow(1), startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", status: "SCHEDULED" as const },
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
    { id: `${ORG1_ID}-tentry-1`, templateId: template1.id, dayOfWeek: 1, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-2`, templateId: template1.id, dayOfWeek: 1, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-3`, templateId: template1.id, dayOfWeek: 2, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-4`, templateId: template1.id, dayOfWeek: 2, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-5`, templateId: template1.id, dayOfWeek: 3, startTime: "08:00", endTime: "16:00", shiftType: "Opening Manager", memberId: `${ORG1_ID}-staff-1`, facilityId: org1Facility1.id },
    { id: `${ORG1_ID}-tentry-6`, templateId: template1.id, dayOfWeek: 3, startTime: "16:00", endTime: "21:00", shiftType: "Closing Manager", memberId: `${ORG1_ID}-staff-2`, facilityId: org1Facility1.id },
    // Org2 Regular Schedule
    { id: `${ORG2_ID}-tentry-1`, templateId: template2.id, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-2`, templateId: template2.id, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-3`, templateId: template2.id, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-4`, templateId: template2.id, dayOfWeek: 4, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
    { id: `${ORG2_ID}-tentry-5`, templateId: template2.id, dayOfWeek: 5, startTime: "09:00", endTime: "17:00", shiftType: "Head Coach", memberId: `${ORG2_ID}-staff-1`, facilityId: org2Facility.id },
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
    { id: `${ORG1_ID}-es-1`, eventId: `${ORG1_ID}-evt-1`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: "Lead instructor" },
    { id: `${ORG1_ID}-es-2`, eventId: `${ORG1_ID}-evt-2`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG1_ID}-es-3`, eventId: `${ORG1_ID}-evt-3`, memberId: `${ORG1_ID}-staff-2`, role: "LEAD" as const, notes: "JO Team practice lead" },
    { id: `${ORG1_ID}-es-4`, eventId: `${ORG1_ID}-evt-3`, memberId: `${ORG1_ID}-staff-1`, role: "ASSISTANT" as const, notes: "Beam specialist" },
    { id: `${ORG1_ID}-es-5`, eventId: `${ORG1_ID}-evt-4`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD" as const, notes: "Competition director" },
    { id: `${ORG1_ID}-es-6`, eventId: `${ORG1_ID}-evt-4`, memberId: `${ORG1_ID}-staff-2`, role: "ASSISTANT" as const, notes: null },
    // Org2 Event Staff
    { id: `${ORG2_ID}-es-1`, eventId: `${ORG2_ID}-evt-1`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG2_ID}-es-2`, eventId: `${ORG2_ID}-evt-1`, memberId: `${ORG2_ID}-staff-2`, role: "VOLUNTEER" as const, notes: "Equipment setup" },
    { id: `${ORG2_ID}-es-3`, eventId: `${ORG2_ID}-evt-2`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: null },
    { id: `${ORG2_ID}-es-4`, eventId: `${ORG2_ID}-evt-3`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD" as const, notes: "Meet coordinator" },
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
    { id: `${ORG1_ID}-ps-1`, programId: `${ORG1_ID}-prog-rec-bronze`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Primary coach for Bronze program" },
    { id: `${ORG1_ID}-ps-2`, programId: `${ORG1_ID}-prog-rec-silver`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    { id: `${ORG1_ID}-ps-3`, programId: `${ORG1_ID}-prog-rec-gold`, memberId: `${ORG1_ID}-staff-1`, role: "ASSISTANT_COACH" as const, isPrimary: false, notes: null },
    { id: `${ORG1_ID}-ps-4`, programId: `${ORG1_ID}-prog-rec-gold`, memberId: `${ORG1_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Primary coach for Gold program" },
    { id: `${ORG1_ID}-ps-5`, programId: `${ORG1_ID}-prog-jo`, memberId: `${ORG1_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "JO Team Head Coach" },
    { id: `${ORG1_ID}-ps-6`, programId: `${ORG1_ID}-prog-jo`, memberId: `${ORG1_ID}-staff-1`, role: "ASSISTANT_COACH" as const, isPrimary: false, notes: "Beam and floor specialist" },
    { id: `${ORG1_ID}-ps-7`, programId: `${ORG1_ID}-prog-preschool`, memberId: `${ORG1_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    // Org2 Program Staff
    { id: `${ORG2_ID}-ps-1`, programId: `${ORG2_ID}-prog-soccer`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Soccer program lead" },
    { id: `${ORG2_ID}-ps-2`, programId: `${ORG2_ID}-prog-soccer`, memberId: `${ORG2_ID}-staff-2`, role: "VOLUNTEER" as const, isPrimary: false, notes: "Volunteer assistant" },
    { id: `${ORG2_ID}-ps-3`, programId: `${ORG2_ID}-prog-basketball`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: null },
    { id: `${ORG2_ID}-ps-4`, programId: `${ORG2_ID}-prog-swim`, memberId: `${ORG2_ID}-staff-1`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Swim team head coach" },
    { id: `${ORG2_ID}-ps-5`, programId: `${ORG2_ID}-prog-fitness`, memberId: `${ORG2_ID}-staff-2`, role: "LEAD_COACH" as const, isPrimary: true, notes: "Kids fitness leader" },
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
    { pattern: "competition", type: "EXACT" as const, reason: "Reserved - prevents confusion with competitions portal" },
    { pattern: "competitions", type: "EXACT" as const, reason: "System use - competitions portal" },
    { pattern: "result", type: "EXACT" as const, reason: "Reserved - prevents confusion with results portal" },
    { pattern: "results", type: "EXACT" as const, reason: "System use - results portal" },
    
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
  // EMAIL CAMPAIGNS & USAGE
  // ============================================
  console.log("\n📧 Creating email campaigns and usage...");

  // Get the current billing period
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Create email usage records for both orgs
  await prisma.emailUsage.upsert({
    where: {
      organizationId_periodStart: {
        organizationId: ORG1_ID,
        periodStart: periodStart,
      },
    },
    update: {},
    create: {
      organizationId: ORG1_ID,
      periodStart: periodStart,
      periodEnd: periodEnd,
      emailsSent: 156,
      emailsDelivered: 152,
      emailsOpened: 89,
      emailsClicked: 34,
      emailsBounced: 3,
      emailsComplained: 0,
      emailsFailed: 1,
      includedEmails: 2500,
      overageEmails: 0,
      overageCost: 0,
    },
  });

  await prisma.emailUsage.upsert({
    where: {
      organizationId_periodStart: {
        organizationId: ORG2_ID,
        periodStart: periodStart,
      },
    },
    update: {},
    create: {
      organizationId: ORG2_ID,
      periodStart: periodStart,
      periodEnd: periodEnd,
      emailsSent: 87,
      emailsDelivered: 85,
      emailsOpened: 52,
      emailsClicked: 18,
      emailsBounced: 1,
      emailsComplained: 0,
      emailsFailed: 1,
      includedEmails: 500,
      overageEmails: 0,
      overageCost: 0,
    },
  });

  // Sample email campaigns for Sunrise Gymnastics
  const sunriseCampaigns = [
    {
      id: "seed-email-campaign-1",
      organizationId: ORG1_ID,
      name: "January Newsletter",
      subject: "Happy New Year from Sunrise Gymnastics! 🎉",
      htmlBody: `<h2>Happy New Year, Sunrise Family!</h2>
<p>We hope you had a wonderful holiday season. As we kick off 2026, we're excited to share what's coming up:</p>
<ul>
<li><strong>Winter Session</strong> begins January 13th</li>
<li><strong>Open Gym</strong> every Saturday 2-4pm</li>
<li><strong>Competition Team tryouts</strong> February 1st</li>
</ul>
<p>Don't forget to register early - spots fill up fast!</p>
<p>See you at the gym!</p>`,
      textBody: "Happy New Year from Sunrise Gymnastics! Winter session begins January 13th.",
      classification: "NEWSLETTER" as const,
      targetScope: "ALL" as const,
      status: "COMPLETED" as const,
      totalRecipients: 89,
      sentCount: 89,
      deliveredCount: 87,
      openedCount: 54,
      clickedCount: 23,
      bouncedCount: 2,
      complainedCount: 0,
      failedCount: 0,
      startedAt: daysAgo(15),
      completedAt: daysAgo(15),
      createdAt: daysAgo(16),
    },
    {
      id: "seed-email-campaign-2",
      organizationId: ORG1_ID,
      name: "Competition Team Update",
      subject: "Important: Regional Competition Details",
      htmlBody: `<h2>Regional Competition - February 15th</h2>
<p>Dear Competition Team Families,</p>
<p>Here are the details for the upcoming regional competition:</p>
<ul>
<li><strong>Date:</strong> Saturday, February 15th</li>
<li><strong>Location:</strong> Springfield Sports Center</li>
<li><strong>Check-in:</strong> 7:30 AM</li>
<li><strong>Competition starts:</strong> 9:00 AM</li>
</ul>
<p>Please make sure your athlete's competition leotard is ready. Let us know if you have any questions!</p>`,
      textBody: "Regional Competition - February 15th at Springfield Sports Center. Check-in at 7:30 AM.",
      classification: "EVENT_UPDATE" as const,
      targetScope: "PROGRAM" as const,
      targetProgramId: `${ORG1_ID}-prog-jo`, // JO Competition Team
      status: "COMPLETED" as const,
      totalRecipients: 24,
      sentCount: 24,
      deliveredCount: 24,
      openedCount: 22,
      clickedCount: 8,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      startedAt: daysAgo(5),
      completedAt: daysAgo(5),
      createdAt: daysAgo(6),
    },
    {
      id: "seed-email-campaign-3",
      organizationId: ORG1_ID,
      name: "Spring Registration Reminder",
      subject: "Spring Session Registration Now Open!",
      htmlBody: `<h2>Spring Session Registration</h2>
<p>Registration for our Spring session is now open!</p>
<p><strong>Spring Session Dates:</strong> March 10 - May 30</p>
<p>Current families get priority registration through February 1st. After that, registration opens to the public.</p>
<p>New this spring:</p>
<ul>
<li>Tumbling & Trampoline class (Ages 8-12)</li>
<li>Parent & Tot sessions on Wednesdays</li>
<li>Extended summer camp options</li>
</ul>
<p>Register now to secure your spot!</p>`,
      textBody: "Spring Session Registration is now open! March 10 - May 30. Register now to secure your spot.",
      classification: "PROGRAM_UPDATE" as const,
      targetScope: "ALL" as const,
      status: "SCHEDULED" as const,
      totalRecipients: 89,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      scheduledAt: daysFromNow(2),
      createdAt: daysAgo(1),
    },
    {
      id: "seed-email-campaign-4",
      organizationId: ORG1_ID,
      name: "Membership Renewal",
      subject: "Your Annual Membership is Expiring Soon",
      htmlBody: `<h2>Membership Renewal Reminder</h2>
<p>Your annual membership at Sunrise Gymnastics is expiring soon.</p>
<p>Renew before the end of the month to:</p>
<ul>
<li>Lock in current rates</li>
<li>Get priority class registration</li>
<li>Receive 10% off summer camps</li>
</ul>
<p>Thank you for being part of our gymnastics family!</p>`,
      textBody: "Your annual membership is expiring soon. Renew before the end of the month to lock in current rates.",
      classification: "MEMBERSHIP" as const,
      targetScope: "ALL" as const,
      targetMembershipStatus: "EXPIRED",
      status: "DRAFT" as const,
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      createdAt: daysAgo(1),
    },
  ];

  for (const campaign of sunriseCampaigns) {
    await prisma.emailCampaign.upsert({
      where: { id: campaign.id },
      update: {},
      create: campaign,
    });
  }
  console.log(`  ✓ Created ${sunriseCampaigns.length} email campaigns for Sunrise Gymnastics`);

  // Sample email campaigns for Metro Sports
  const metroCampaigns = [
    {
      id: "seed-email-campaign-5",
      organizationId: ORG2_ID,
      name: "February Programs",
      subject: "New Programs Starting in February",
      htmlBody: `<h2>Exciting New Programs at Metro Sports!</h2>
<p>Check out what's new this February:</p>
<ul>
<li><strong>Youth Basketball League</strong> - Saturdays 9am-12pm</li>
<li><strong>Adult Fitness Bootcamp</strong> - Mon/Wed/Fri 6am</li>
<li><strong>Family Swim Nights</strong> - Fridays 6-8pm</li>
</ul>
<p>Early bird pricing available through January 31st!</p>`,
      textBody: "New programs starting in February at Metro Sports. Youth Basketball, Adult Fitness, Family Swim Nights.",
      classification: "NEWSLETTER" as const,
      targetScope: "ALL" as const,
      status: "COMPLETED" as const,
      totalRecipients: 67,
      sentCount: 67,
      deliveredCount: 65,
      openedCount: 38,
      clickedCount: 12,
      bouncedCount: 1,
      complainedCount: 0,
      failedCount: 1,
      startedAt: daysAgo(10),
      completedAt: daysAgo(10),
      createdAt: daysAgo(11),
    },
    {
      id: "seed-email-campaign-6",
      organizationId: ORG2_ID,
      name: "Swim Team Practice Update",
      subject: "Updated Practice Schedule - Swim Team",
      htmlBody: `<h2>Swim Team Practice Schedule Update</h2>
<p>Starting next week, we're adjusting practice times:</p>
<ul>
<li><strong>Monday/Wednesday:</strong> 4:00 PM - 5:30 PM (was 4:30 PM)</li>
<li><strong>Friday:</strong> 3:30 PM - 5:00 PM (no change)</li>
<li><strong>Saturday:</strong> 8:00 AM - 10:00 AM (no change)</li>
</ul>
<p>Please update your calendars accordingly. See you at the pool!</p>`,
      textBody: "Updated swim team practice times starting next week. Monday/Wednesday now 4:00 PM - 5:30 PM.",
      classification: "PROGRAM_UPDATE" as const,
      targetScope: "PROGRAM" as const,
      targetProgramId: `${ORG2_ID}-prog-swim`, // Swim Team
      status: "COMPLETED" as const,
      totalRecipients: 20,
      sentCount: 20,
      deliveredCount: 20,
      openedCount: 14,
      clickedCount: 6,
      bouncedCount: 0,
      complainedCount: 0,
      failedCount: 0,
      startedAt: daysAgo(3),
      completedAt: daysAgo(3),
      createdAt: daysAgo(4),
    },
  ];

  for (const campaign of metroCampaigns) {
    await prisma.emailCampaign.upsert({
      where: { id: campaign.id },
      update: {},
      create: campaign,
    });
  }
  console.log(`  ✓ Created ${metroCampaigns.length} email campaigns for Metro Sports`);

  // ============================================
  // NOTIFICATION RULES
  // ============================================
  console.log("\n🔔 Creating notification rules...");

  // Helper function to create notification rules with templates
  const createNotificationRule = async (data: {
    id: string;
    organizationId: string;
    name: string;
    description: string;
    triggerType: string;
    timingValue: number;
    timingUnit: string;
    timingDirection: string;
    actionType: string;
    isSystem: boolean;
    subject?: string;
    body: string;
    smsBody?: string;
    recipientType: string;
  }) => {
    const rule = await prisma.notificationRule.upsert({
      where: { id: data.id },
      update: {},
      create: {
        id: data.id,
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType as any,
        timingValue: data.timingValue,
        timingUnit: data.timingUnit as any,
        timingDirection: data.timingDirection as any,
        actionType: data.actionType as any,
        isSystem: data.isSystem,
        isActive: true,
      },
    });

    // Create template
    await prisma.notificationTemplate.upsert({
      where: { notificationRuleId: rule.id },
      update: {},
      create: {
        notificationRuleId: rule.id,
        subject: data.subject,
        body: data.body,
        smsBody: data.smsBody,
      },
    });

    // Create recipient config
    await prisma.notificationRecipientConfig.upsert({
      where: { notificationRuleId: rule.id },
      update: {},
      create: {
        notificationRuleId: rule.id,
        recipientType: data.recipientType as any,
        filters: {},
      },
    });

    return rule;
  };

  // System notification rules for Sunrise Gymnastics
  const sunriseNotificationRules = [
    {
      id: `${ORG1_ID}-notif-payment-reminder`,
      organizationId: ORG1_ID,
      name: "Payment Reminder",
      description: "Reminder sent 3 days before payment is due",
      triggerType: "PAYMENT_DUE",
      timingValue: 3,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Payment Reminder - {{invoiceReference}}",
      body: `Dear {{guardianName}},

This is a friendly reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is due on {{dueDate}}.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Due Date: {{dueDate}}

To make a payment, please visit: {{paymentUrl}}

If you have already made this payment, please disregard this notice.

Thank you,
{{organizationName}}`,
      smsBody: `{{organizationName}}: Payment of {{invoiceAmount}} ({{invoiceReference}}) is due {{dueDate}}. Pay now: {{paymentUrl}}`,
      recipientType: "ALL_GUARDIANS",
    },
    {
      id: `${ORG1_ID}-notif-payment-urgent`,
      organizationId: ORG1_ID,
      name: "Payment Reminder Urgent",
      description: "Urgent reminder sent 1 day after payment is overdue",
      triggerType: "PAYMENT_OVERDUE",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "EMAIL",
      isSystem: true,
      subject: "URGENT: Payment Overdue - {{invoiceReference}}",
      body: `Dear {{guardianName}},

This is an urgent reminder that payment of {{invoiceAmount}} for {{invoiceDescription}} is now overdue.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Original Due Date: {{dueDate}}

Please make payment immediately to avoid any service interruptions: {{paymentUrl}}

If you need to discuss payment options, please contact us at {{organizationEmail}}.

Thank you,
{{organizationName}}`,
      smsBody: `URGENT from {{organizationName}}: Payment of {{invoiceAmount}} is overdue. Please pay now: {{paymentUrl}}`,
      recipientType: "ALL_GUARDIANS",
    },
    {
      id: `${ORG1_ID}-notif-membership-warning`,
      organizationId: ORG1_ID,
      name: "Membership Expiry Warning",
      description: "Warning sent 7 days before membership expires",
      triggerType: "MEMBERSHIP_EXPIRY",
      timingValue: 7,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Your Membership is Expiring Soon - {{athleteName}}",
      body: `Dear {{guardianName}},

This is a reminder that {{athleteName}}'s {{membershipName}} will expire on {{membershipEndDate}}.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expiration Date: {{membershipEndDate}}
Days Remaining: {{membershipDaysRemaining}}

To ensure uninterrupted participation in classes and events, please renew the membership before it expires.

If you have any questions, please contact us at {{organizationEmail}}.

Thank you for being part of the Sunrise Gymnastics family!
{{organizationName}}`,
      smsBody: `{{organizationName}}: {{athleteName}}'s {{membershipName}} expires {{membershipEndDate}}. Please renew to continue participation.`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG1_ID}-notif-membership-urgent`,
      organizationId: ORG1_ID,
      name: "Membership Expiry Urgent",
      description: "Urgent notice sent 1 day after membership expires",
      triggerType: "MEMBERSHIP_EXPIRED",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "EMAIL",
      isSystem: true,
      subject: "URGENT: Membership Expired - {{athleteName}}",
      body: `Dear {{guardianName}},

This is an urgent notice that {{athleteName}}'s {{membershipName}} has expired.

Membership: {{membershipName}}
Athlete: {{athleteName}}
Expired On: {{membershipEndDate}}

{{athleteName}} will not be able to participate in programs until the membership is renewed.

Please renew as soon as possible to avoid any disruption. Contact us at {{organizationEmail}} if you need assistance.

Thank you,
{{organizationName}}`,
      smsBody: `URGENT from {{organizationName}}: {{athleteName}}'s membership has EXPIRED. Please renew immediately to continue participation.`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG1_ID}-notif-program-reminder`,
      organizationId: ORG1_ID,
      name: "Program Reminder",
      description: "Reminder sent 1 day before class/event",
      triggerType: "PROGRAM_REMINDER",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Reminder: {{programName}} Tomorrow - {{eventDate}}",
      body: `Dear {{guardianName}},

This is a reminder that {{athleteName}} has {{programName}} tomorrow.

Program: {{programName}}
Date: {{eventDate}}
Time: {{eventTime}}
Location: {{eventLocation}}

Please ensure {{athleteFirstName}} arrives on time and has all necessary equipment (leotard, water bottle, hair tied back).

See you at the gym!
{{organizationName}}`,
      smsBody: `{{organizationName}}: Reminder - {{athleteFirstName}} has {{programName}} on {{eventDate}} at {{eventTime}}.`,
      recipientType: "PROGRAM_MEMBERS",
    },
    // Custom notification for Sunrise
    {
      id: `${ORG1_ID}-notif-birthday`,
      organizationId: ORG1_ID,
      name: "Birthday Wishes",
      description: "Birthday greeting sent on athlete's birthday",
      triggerType: "BIRTHDAY",
      timingValue: 0,
      timingUnit: "DAYS",
      timingDirection: "AT",
      actionType: "EMAIL",
      isSystem: false,
      subject: "Happy Birthday, {{athleteFirstName}}! 🎂",
      body: `Dear {{guardianName}},

Happy Birthday to {{athleteName}}! 🎉

Everyone at Sunrise Gymnastics wishes {{athleteFirstName}} a wonderful birthday filled with flips, tumbles, and lots of fun!

As a special birthday treat, {{athleteFirstName}} will receive a small gift at their next class.

Best wishes,
The Sunrise Gymnastics Team
{{organizationName}}`,
      smsBody: `🎂 Happy Birthday, {{athleteFirstName}}! From your friends at {{organizationName}}!`,
      recipientType: "ALL_GUARDIANS",
    },
  ];

  for (const rule of sunriseNotificationRules) {
    await createNotificationRule(rule);
  }
  console.log(`  ✓ Created ${sunriseNotificationRules.length} notification rules for Sunrise Gymnastics`);

  // System notification rules for Metro Sports
  const metroNotificationRules = [
    {
      id: `${ORG2_ID}-notif-payment-reminder`,
      organizationId: ORG2_ID,
      name: "Payment Reminder",
      description: "Reminder sent 3 days before payment is due",
      triggerType: "PAYMENT_DUE",
      timingValue: 3,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Payment Reminder - {{invoiceReference}}",
      body: `Dear {{guardianName}},

This is a friendly reminder that payment of {{invoiceAmount}} is due on {{dueDate}}.

Invoice Reference: {{invoiceReference}}
Amount Due: {{invoiceAmount}}
Due Date: {{dueDate}}

Pay online at: {{paymentUrl}}

Questions? Contact us at {{organizationEmail}}.

Thanks,
{{organizationName}}`,
      smsBody: `Metro Sports: Payment of {{invoiceAmount}} due {{dueDate}}. Pay now: {{paymentUrl}}`,
      recipientType: "ALL_GUARDIANS",
    },
    {
      id: `${ORG2_ID}-notif-payment-urgent`,
      organizationId: ORG2_ID,
      name: "Payment Reminder Urgent",
      description: "Urgent reminder sent 1 day after payment is overdue",
      triggerType: "PAYMENT_OVERDUE",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "SMS",
      isSystem: true,
      subject: "URGENT: Payment Overdue",
      body: `Dear {{guardianName}},

Your payment of {{invoiceAmount}} is now overdue. Please pay immediately to continue participating in programs.

Pay now: {{paymentUrl}}

Contact {{organizationEmail}} for questions.

{{organizationName}}`,
      smsBody: `URGENT Metro Sports: Payment of {{invoiceAmount}} overdue. Pay now to avoid service interruption: {{paymentUrl}}`,
      recipientType: "ALL_GUARDIANS",
    },
    {
      id: `${ORG2_ID}-notif-membership-warning`,
      organizationId: ORG2_ID,
      name: "Membership Expiry Warning",
      description: "Warning sent 7 days before membership expires",
      triggerType: "MEMBERSHIP_EXPIRY",
      timingValue: 7,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: true,
      subject: "Membership Expiring - {{athleteName}}",
      body: `Hi {{guardianFirstName}},

{{athleteName}}'s membership at Metro Sports is expiring on {{membershipEndDate}}.

Membership: {{membershipName}}
Days Remaining: {{membershipDaysRemaining}}

Renew now to continue enjoying our facilities and programs!

Best,
{{organizationName}}`,
      smsBody: `Metro Sports: {{athleteName}}'s membership expires {{membershipEndDate}}. Renew now!`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG2_ID}-notif-membership-urgent`,
      organizationId: ORG2_ID,
      name: "Membership Expiry Urgent",
      description: "Urgent notice sent 1 day after membership expires",
      triggerType: "MEMBERSHIP_EXPIRED",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "AFTER",
      actionType: "SMS",
      isSystem: true,
      subject: "Membership Expired - Action Required",
      body: `Hi {{guardianFirstName}},

{{athleteName}}'s membership has expired. Please renew to continue participation.

Contact us at {{organizationEmail}}.

{{organizationName}}`,
      smsBody: `Metro Sports: {{athleteName}}'s membership EXPIRED. Renew immediately at {{organizationEmail}}`,
      recipientType: "MEMBERSHIP_HOLDERS",
    },
    {
      id: `${ORG2_ID}-notif-program-reminder`,
      organizationId: ORG2_ID,
      name: "Program Reminder",
      description: "Reminder sent 1 day before class/event",
      triggerType: "PROGRAM_REMINDER",
      timingValue: 1,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "SMS",
      isSystem: true,
      subject: "{{programName}} Tomorrow",
      body: `Hi {{guardianFirstName}},

Reminder: {{athleteFirstName}} has {{programName}} tomorrow at {{eventTime}}.

Location: {{eventLocation}}

See you there!
{{organizationName}}`,
      smsBody: `Metro Sports: {{athleteFirstName}} has {{programName}} tomorrow at {{eventTime}} - {{eventLocation}}`,
      recipientType: "PROGRAM_MEMBERS",
    },
    // Custom notification for Metro Sports
    {
      id: `${ORG2_ID}-notif-registration-open`,
      organizationId: ORG2_ID,
      name: "Registration Opening",
      description: "Notification when registration opens for a new season",
      triggerType: "EVENT_REGISTRATION_OPEN",
      timingValue: 2,
      timingUnit: "DAYS",
      timingDirection: "BEFORE",
      actionType: "EMAIL",
      isSystem: false,
      subject: "Registration Opens Soon: {{eventName}}",
      body: `Dear {{guardianName}},

We're excited to announce that registration for {{eventName}} opens in 2 days!

Event: {{eventName}}
Registration Opens: {{eventDate}}

Mark your calendar and register early - spots fill up fast!

Visit {{websiteUrl}} to register.

See you at Metro Sports!
{{organizationName}}`,
      smsBody: `Metro Sports: {{eventName}} registration opens {{eventDate}}! Register early at {{websiteUrl}}`,
      recipientType: "ALL_GUARDIANS",
    },
  ];

  for (const rule of metroNotificationRules) {
    await createNotificationRule(rule);
  }
  console.log(`  ✓ Created ${metroNotificationRules.length} notification rules for Metro Sports`);

  // ============================================
  // WAIVERS & DIGITAL SIGNATURES
  // ============================================
  console.log("\n📝 Creating waivers...");

  // Sunrise Gymnastics Academy - General Liability Waiver (2 pages)
  await prisma.waiver.upsert({
    where: { id: `${ORG1_ID}-waiver-liability` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability`,
      organizationId: ORG1_ID,
      title: "General Liability Waiver",
      status: "ACTIVE",
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-liability-p1` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability-p1`,
      waiverId: `${ORG1_ID}-waiver-liability`,
      pageNumber: 1,
      title: "Assumption of Risk & Release of Liability",
      content: `<h2>Assumption of Risk & Release of Liability</h2>
<p>I, the undersigned participant (or parent/guardian of a minor participant), acknowledge and agree to the following:</p>
<h3>1. Assumption of Risk</h3>
<p>I understand that participation in gymnastics and related activities involves inherent risks of physical injury, including but not limited to sprains, fractures, concussions, paralysis, and in rare cases, death. I voluntarily assume all risks associated with participation in programs offered by Sunrise Gymnastics Academy.</p>
<h3>2. Release of Liability</h3>
<p>In consideration of being permitted to participate in programs, I hereby release, waive, and discharge Sunrise Gymnastics Academy, its owners, officers, employees, coaches, volunteers, and agents from any and all liability, claims, demands, actions, or causes of action arising out of or related to any loss, damage, or injury that may be sustained during participation.</p>
<h3>3. Indemnification</h3>
<p>I agree to indemnify and hold harmless Sunrise Gymnastics Academy from any loss, liability, damage, or cost it may incur due to my (or my child's) participation in programs, whether caused by negligence or otherwise.</p>
<p><strong>I have read this Assumption of Risk & Release of Liability, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-liability-p2` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-liability-p2`,
      waiverId: `${ORG1_ID}-waiver-liability`,
      pageNumber: 2,
      title: "Medical Authorization & Emergency Contact",
      content: `<h2>Medical Authorization & Emergency Contact Consent</h2>
<h3>4. Medical Authorization</h3>
<p>In the event of an emergency, I authorize Sunrise Gymnastics Academy staff to seek and obtain emergency medical treatment for the participant. I understand that I will be responsible for the cost of any such treatment.</p>
<p>I certify that the participant is in good physical health and has no conditions that would prevent safe participation in gymnastics activities, unless otherwise disclosed in writing to the Academy.</p>
<h3>5. Emergency Contact Consent</h3>
<p>I consent to being contacted at the phone number and email address provided on my registration form in case of emergency. I understand that the Academy will make reasonable efforts to contact me before seeking emergency medical treatment.</p>
<h3>6. Photo/Video for Safety Documentation</h3>
<p>I understand that the Academy may use video monitoring for safety and coaching purposes within the facility. This footage is for internal use only and will not be shared publicly without separate consent.</p>
<p><strong>I have read this Medical Authorization & Emergency Contact Consent, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  // Sunrise Gymnastics Academy - Photo & Video Release (1 page)
  await prisma.waiver.upsert({
    where: { id: `${ORG1_ID}-waiver-photo` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-photo`,
      organizationId: ORG1_ID,
      title: "Photo & Video Release",
      status: "ACTIVE",
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG1_ID}-waiver-photo-p1` },
    update: {},
    create: {
      id: `${ORG1_ID}-waiver-photo-p1`,
      waiverId: `${ORG1_ID}-waiver-photo`,
      pageNumber: 1,
      title: "Photo & Video Consent",
      content: `<h2>Photo & Video Release Consent</h2>
<p>I, the undersigned (or parent/guardian of a minor participant), hereby grant Sunrise Gymnastics Academy permission to:</p>
<ul>
<li>Take photographs and/or video recordings of the participant during programs, events, competitions, and activities.</li>
<li>Use such photographs and recordings for promotional purposes including but not limited to the Academy's website, social media channels, printed marketing materials, newsletters, and press releases.</li>
</ul>
<h3>Terms</h3>
<p>I understand that:</p>
<ul>
<li>No compensation will be provided for the use of these images or recordings.</li>
<li>The Academy will not use images in a manner that is harmful or defamatory.</li>
<li>I may revoke this consent at any time by providing written notice to the Academy, though images already published may not be retrievable.</li>
<li>This release is valid for the duration of the participant's enrollment at Sunrise Gymnastics Academy.</li>
</ul>
<p><strong>I have read this Photo & Video Release, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  // Metro Sports Complex - Participant Waiver & Release of Liability (2 pages)
  await prisma.waiver.upsert({
    where: { id: `${ORG2_ID}-waiver-participant` },
    update: {},
    create: {
      id: `${ORG2_ID}-waiver-participant`,
      organizationId: ORG2_ID,
      title: "Participant Waiver & Release of Liability",
      status: "ACTIVE",
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG2_ID}-waiver-participant-p1` },
    update: {},
    create: {
      id: `${ORG2_ID}-waiver-participant-p1`,
      waiverId: `${ORG2_ID}-waiver-participant`,
      pageNumber: 1,
      title: "Assumption of Risk & Hold-Harmless Agreement",
      content: `<h2>Assumption of Risk & Hold-Harmless Agreement</h2>
<p>I, the undersigned participant (or parent/legal guardian of a minor participant), acknowledge the following in connection with participation in programs and activities offered by Metro Sports Complex:</p>
<h3>1. Acknowledgment of Risk</h3>
<p>I understand that participation in sports and recreational activities, including but not limited to soccer, basketball, swimming, fitness classes, and general facility use, carries inherent risks of physical injury. These risks include but are not limited to muscle strains, ligament tears, broken bones, concussions, drowning, heat-related illness, and other injuries that may result from the physical nature of these activities.</p>
<h3>2. Voluntary Participation</h3>
<p>I voluntarily choose to participate (or allow my child to participate) in programs at Metro Sports Complex with full knowledge and understanding of the associated risks. I accept personal responsibility for any injury that may occur.</p>
<h3>3. Hold-Harmless Agreement</h3>
<p>I agree to release, hold harmless, and indemnify Metro Sports Complex, its owners, managers, employees, coaches, trainers, volunteers, and affiliated organizations from any and all claims, liabilities, damages, costs, or expenses arising from participation in programs or use of facilities.</p>
<p><strong>I have read this Assumption of Risk & Hold-Harmless Agreement, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  await prisma.waiverPage.upsert({
    where: { id: `${ORG2_ID}-waiver-participant-p2` },
    update: {},
    create: {
      id: `${ORG2_ID}-waiver-participant-p2`,
      waiverId: `${ORG2_ID}-waiver-participant`,
      pageNumber: 2,
      title: "Facility Rules & Emergency Medical Authorization",
      content: `<h2>Acknowledgement of Facility Rules & Emergency Medical Authorization</h2>
<h3>4. Facility Rules</h3>
<p>I acknowledge that I have been informed of and agree to abide by all rules and regulations of Metro Sports Complex, including but not limited to:</p>
<ul>
<li>Following all posted safety signs and instructions from staff.</li>
<li>Using equipment only as intended and under appropriate supervision.</li>
<li>Reporting any unsafe conditions or injuries to staff immediately.</li>
<li>Wearing appropriate athletic attire and footwear for each activity.</li>
<li>Not participating while under the influence of alcohol or drugs.</li>
</ul>
<p>Failure to comply with facility rules may result in removal from programs without refund.</p>
<h3>5. Emergency Medical Authorization</h3>
<p>In the event of an injury or medical emergency, I authorize Metro Sports Complex staff to administer first aid and/or call emergency medical services (911). I understand that I (or my insurance) will be responsible for any medical costs incurred. I consent to being transported to the nearest medical facility if deemed necessary by emergency personnel.</p>
<h3>6. Communication Consent</h3>
<p>I consent to receiving communications from Metro Sports Complex regarding schedules, cancellations, and safety updates via email, phone, or text message at the contact information provided during registration.</p>
<p><strong>I have read this Acknowledgement of Facility Rules & Emergency Medical Authorization, fully understand its terms, and sign it freely and voluntarily.</strong></p>`,
    },
  });

  // Attach waivers as program requirements
  // Sunrise: General Liability Waiver on the Bronze program
  await prisma.programWaiverRequirement.upsert({
    where: {
      programId_waiverId: {
        programId: `${ORG1_ID}-prog-rec-bronze`,
        waiverId: `${ORG1_ID}-waiver-liability`,
      },
    },
    update: {},
    create: {
      programId: `${ORG1_ID}-prog-rec-bronze`,
      waiverId: `${ORG1_ID}-waiver-liability`,
    },
  });

  // Update the program to have the waiver restriction flag
  await prisma.program.update({
    where: { id: `${ORG1_ID}-prog-rec-bronze` },
    data: { hasWaiverRestriction: true },
  });

  // Metro: Participant Waiver on the soccer program
  await prisma.programWaiverRequirement.upsert({
    where: {
      programId_waiverId: {
        programId: `${ORG2_ID}-prog-soccer`,
        waiverId: `${ORG2_ID}-waiver-participant`,
      },
    },
    update: {},
    create: {
      programId: `${ORG2_ID}-prog-soccer`,
      waiverId: `${ORG2_ID}-waiver-participant`,
    },
  });

  await prisma.program.update({
    where: { id: `${ORG2_ID}-prog-soccer` },
    data: { hasWaiverRestriction: true },
  });

  console.log("  ✓ Created 3 waivers (2 Sunrise, 1 Metro) with pages");
  console.log("  ✓ Attached waiver requirements to Bronze Gymnastics and Youth Soccer");

  // ============================================
  // COMPETITIONS (Full examples with entries and results)
  // ============================================
  console.log("\n🏆 Creating competitions...");

  // --- Sunrise Gymnastics: Spring Invitational (REGISTRATION_OPEN) ---
  const gymCompetition = await prisma.competition.upsert({
    where: { id: `${ORG1_ID}-comp-spring-inv` },
    update: {},
    create: {
      id: `${ORG1_ID}-comp-spring-inv`,
      organizationId: ORG1_ID,
      name: "Spring Invitational 2026",
      color: "#d946ef",
      competitionType: "GYMNASTICS",
      status: "REGISTRATION_OPEN",
      facilityId: `${ORG1_ID}-facility-main`,
      country: "US",
      stateProvince: "CA",
      city: "San Mateo",
      streetAddress: "100 Gymnastics Way",
      startDate: daysFromNow(45),
      endDate: daysFromNow(46),
      startTime: "08:00",
      endTime: "18:00",
      categoryMode: "SPECIFIC",
      hasAgeRestriction: true,
      minAge: 6,
      maxAge: 18,
      hasMembershipRestriction: true,
      membershipRequirementIds: [`${ORG1_ID}-mi-2026`],
      publishStatus: "LIVE",
    },
  });

  // Competition categories for gym: Floor (U10), Vault (U10), Bars (U12)
  const gymCompCats = [
    {
      id: `${ORG1_ID}-compcat-floor-u10`,
      competitionId: gymCompetition.id,
      combinationEntryId: "combo-gym-cav-gym-u10-cav-gym-floor",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: true,
      submissionMode: "MANUAL_ENTRY" as const,
      qualifyingMark: 7.0,
      displayOrder: 0,
    },
    {
      id: `${ORG1_ID}-compcat-vault-u10`,
      competitionId: gymCompetition.id,
      combinationEntryId: "combo-gym-cav-gym-u10-cav-gym-vault",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: false,
      submissionMode: "NONE" as const,
      displayOrder: 1,
    },
    {
      id: `${ORG1_ID}-compcat-bars-u12`,
      competitionId: gymCompetition.id,
      combinationEntryId: "combo-gym-cav-gym-u12-cav-gym-bars",
      resultType: "SCORE" as const,
      sortDirection: "DESC" as const,
      precision: 3,
      seedMarkRequired: true,
      submissionMode: "MANUAL_ENTRY" as const,
      qualifyingMark: 6.5,
      displayOrder: 2,
    },
  ];

  for (const cat of gymCompCats) {
    await prisma.competitionCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // Entries for gym competition
  const gymCompEntries = [
    {
      id: `${ORG1_ID}-compentry-1`,
      competitionId: gymCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-floor-u10`,
      athleteId: `${ORG1_ID}-ath-1`,
      status: "APPROVED" as const,
      seedPoints: 8.250,
      seedMarkSubmittedAt: daysAgo(10),
      seedMarkStatus: "APPROVED" as const,
    },
    {
      id: `${ORG1_ID}-compentry-2`,
      competitionId: gymCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-floor-u10`,
      athleteId: `${ORG1_ID}-ath-2`,
      status: "PENDING_REVIEW" as const,
      seedPoints: 7.100,
      seedMarkSubmittedAt: daysAgo(5),
      seedMarkStatus: "PENDING" as const,
    },
    {
      id: `${ORG1_ID}-compentry-3`,
      competitionId: gymCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-vault-u10`,
      athleteId: `${ORG1_ID}-ath-1`,
      status: "APPROVED" as const,
    },
    {
      id: `${ORG1_ID}-compentry-4`,
      competitionId: gymCompetition.id,
      competitionCategoryId: `${ORG1_ID}-compcat-bars-u12`,
      athleteId: `${ORG1_ID}-ath-3`,
      status: "PENDING_SEED" as const,
    },
  ];

  for (const entry of gymCompEntries) {
    await prisma.competitionEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }
  console.log("  ✓ Created Sunrise Gymnastics 'Spring Invitational 2026' (REGISTRATION_OPEN)");

  // --- Metro Sports: Regional Athletics Meet (COMPLETED) ---
  const tfCompetition = await prisma.competition.upsert({
    where: { id: `${ORG2_ID}-comp-regional-track` },
    update: {},
    create: {
      id: `${ORG2_ID}-comp-regional-track`,
      organizationId: ORG2_ID,
      name: "Regional Athletics Meet 2026",
      color: "#6366f1",
      competitionType: "ATHLETICS",
      status: "COMPLETED",
      facilityId: `${ORG2_ID}-facility-main`,
      country: "US",
      stateProvince: "CA",
      city: "Oakland",
      streetAddress: "200 Stadium Drive",
      startDate: daysAgo(14),
      endDate: daysAgo(14),
      startTime: "08:00",
      endTime: "17:00",
      categoryMode: "SPECIFIC",
      pricingMode: "TIERED",
      publishStatus: "LIVE",
    },
  });

  // Pricing tiers for tiered mode
  const tfPricingTiers = [
    { id: `${ORG2_ID}-tier-1`, competitionId: tfCompetition.id, minEvents: 1, maxEvents: 2, pricePerEvent: 25.00, displayOrder: 0 },
    { id: `${ORG2_ID}-tier-2`, competitionId: tfCompetition.id, minEvents: 3, maxEvents: 5, pricePerEvent: 20.00, displayOrder: 1 },
    { id: `${ORG2_ID}-tier-3`, competitionId: tfCompetition.id, minEvents: 6, maxEvents: null, pricePerEvent: 15.00, displayOrder: 2 },
  ];
  for (const tier of tfPricingTiers) {
    await prisma.competitionPricingTier.upsert({
      where: { id: tier.id },
      update: {},
      create: tier,
    });
  }
  console.log(`  ✓ Created ${tfPricingTiers.length} pricing tiers for Regional Athletics Meet`);

  // Competition categories using sport-specific refs: 100m (U10), Long Jump (U12), 4x100 Relay (U10, team)
  const tfCompCats = [
    {
      id: `${ORG2_ID}-compcat-100m-u10`,
      competitionId: tfCompetition.id,
      sportEventId: "athl-evt-100M",
      ageCategoryId: "athl-age-U10",
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
      precision: 3,
      seedMarkRequired: true,
      submissionMode: "VERIFIED_RESULT" as const,
      qualifyingMark: 16000,
      displayOrder: 0,
    },
    {
      id: `${ORG2_ID}-compcat-longjump-u12`,
      competitionId: tfCompetition.id,
      sportEventId: "athl-evt-LJ",
      ageCategoryId: "athl-age-U12",
      resultType: "DISTANCE" as const,
      sortDirection: "DESC" as const,
      precision: 2,
      seedMarkRequired: false,
      submissionMode: "NONE" as const,
      displayOrder: 1,
    },
    {
      id: `${ORG2_ID}-compcat-4x100-relay`,
      competitionId: tfCompetition.id,
      sportEventId: "athl-evt-4X100",
      ageCategoryId: "athl-age-U10",
      resultType: "TIME" as const,
      sortDirection: "ASC" as const,
      precision: 3,
      isTeamEvent: true,
      teamSize: 4,
      seedMarkRequired: false,
      submissionMode: "NONE" as const,
      displayOrder: 2,
    },
  ];

  for (const cat of tfCompCats) {
    await prisma.competitionCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: cat,
    });
  }

  // Team for the relay
  await prisma.competitionTeam.upsert({
    where: { id: `${ORG2_ID}-team-relay-1` },
    update: {},
    create: {
      id: `${ORG2_ID}-team-relay-1`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-4x100-relay`,
      name: "Metro A Team",
      organizationId: ORG2_ID,
    },
  });

  // Entries for track meet
  const tfCompEntries = [
    {
      id: `${ORG2_ID}-compentry-1`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-100m-u10`,
      athleteId: `${ORG2_ID}-ath-1`,
      status: "APPROVED" as const,
      seedHours: 0,
      seedMinutes: 0,
      seedSeconds: 14,
      seedMs: 500,
      seedHandTimed: false,
      seedMarkSubmittedAt: daysAgo(30),
      seedMarkStatus: "APPROVED" as const,
    },
    {
      id: `${ORG2_ID}-compentry-2`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-100m-u10`,
      athleteId: `${ORG2_ID}-ath-2`,
      status: "APPROVED" as const,
      seedHours: 0,
      seedMinutes: 0,
      seedSeconds: 15,
      seedMs: 200,
      seedHandTimed: true,
      seedMarkSubmittedAt: daysAgo(28),
      seedMarkStatus: "APPROVED" as const,
    },
    {
      id: `${ORG2_ID}-compentry-3`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-longjump-u12`,
      athleteId: `${ORG2_ID}-ath-3`,
      status: "APPROVED" as const,
    },
    {
      id: `${ORG2_ID}-compentry-4`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-4x100-relay`,
      athleteId: `${ORG2_ID}-ath-1`,
      teamId: `${ORG2_ID}-team-relay-1`,
      status: "APPROVED" as const,
    },
    {
      id: `${ORG2_ID}-compentry-5`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-4x100-relay`,
      athleteId: `${ORG2_ID}-ath-2`,
      teamId: `${ORG2_ID}-team-relay-1`,
      status: "APPROVED" as const,
    },
  ];

  for (const entry of tfCompEntries) {
    await prisma.competitionEntry.upsert({
      where: { id: entry.id },
      update: {},
      create: entry,
    });
  }

  // Results for completed track meet
  const tfResults = [
    {
      id: `${ORG2_ID}-result-1`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-100m-u10`,
      athleteId: `${ORG2_ID}-ath-1`,
      value: 13850,
      displayValue: "13.85",
      placement: 1,
      heat: 1,
      isHandTimed: false,
      isPersonalBest: true,
    },
    {
      id: `${ORG2_ID}-result-2`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-100m-u10`,
      athleteId: `${ORG2_ID}-ath-2`,
      value: 14300,
      displayValue: "14.3h",
      placement: 2,
      heat: 1,
      isHandTimed: true,
      isPersonalBest: true,
    },
    {
      id: `${ORG2_ID}-result-3`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-longjump-u12`,
      athleteId: `${ORG2_ID}-ath-3`,
      value: 3750,
      displayValue: "3.75m",
      placement: 1,
      isPersonalBest: false,
    },
    {
      id: `${ORG2_ID}-result-4`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-longjump-u12`,
      athleteId: `${ORG2_ID}-ath-3`,
      value: 3500,
      displayValue: "3.50m",
      attemptNumber: 2,
      isBestAttempt: false,
    },
    {
      id: `${ORG2_ID}-result-5`,
      competitionId: tfCompetition.id,
      competitionCategoryId: `${ORG2_ID}-compcat-4x100-relay`,
      teamId: `${ORG2_ID}-team-relay-1`,
      value: 58200,
      displayValue: "58.200s",
      placement: 1,
    },
  ];

  for (const result of tfResults) {
    await prisma.competitionResult.upsert({
      where: { id: result.id },
      update: {},
      create: result,
    });
  }
  console.log("  ✓ Created Metro Sports 'Regional Athletics Meet 2026' (COMPLETED)");

  // ============================================
  // COMPLETE
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Development seed completed successfully!");
  console.log("=".repeat(50));
  console.log("\nCreated data summary:");
  console.log("  • 4 organizations (Sunrise Gymnastics, Metro Sports, Demo Gym, Uplifter)");
  console.log("  • 4 subscription plans");
  console.log("  • 6 sports with organization associations");
  console.log("  • 32 athletics events, 8 age categories, ~210 eligibility entries");
  console.log("  • 10 users with permissions");
  console.log("  • 9 families with payment methods");
  console.log("  • 14 athletes with guardian relationships");
  console.log("  • 9 programs with membership tiers");
  console.log("  • 12 program staff assignments (coaches)");
  console.log("  • 3 programs with membership requirements");
  console.log("  • 33+ events with 64+ attendance records (historical + current)");
  console.log("  • 5 invoices with line items and payments");
  console.log("  • 9 transactions (Adyen)");
  console.log("  • 5 payouts (settlements)");
  console.log("  • 7 recurring charges");
  console.log("  • 34 gymnastics skills with difficulty levels and age ranges");
  console.log("  • 8 evaluation templates with skill groupings (5 Sunrise + 3 Metro)");
  console.log("  • 9 evaluations with skill attempt statuses (5 Sunrise + 4 Metro)");
  console.log("  • 17 athlete skill progress records");
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
  console.log("  • 6 email campaigns (newsletters, program updates, scheduled)");
  console.log("  • Email usage tracking for both organizations");
  console.log("  • 12 notification rules (system + custom for both orgs)");
  console.log("  • 3 waivers with pages (2 Sunrise, 1 Metro) + program requirements");
  console.log("  • 2 competitions (1 gymnastics REGISTRATION_OPEN, 1 athletics COMPLETED)");
  console.log("  • 6 competition categories with result type/seed mark config");
  console.log("  • 9 competition entries (approved, pending review, pending seed)");
  console.log("  • 5 competition results with placements and personal bests");
  console.log("  • 1 relay team with team results");
  console.log("  • 90 days of visitor analytics (if Redis configured)");
  console.log("\nTest accounts (use email-based login — no passwords set):");
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
