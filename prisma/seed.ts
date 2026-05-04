/**
 * Bootstrap Seed Script (seed.ts)
 * ===============================
 *
 * Minimal data needed for the app to **boot and log in**, and nothing else.
 * Safe to run in production or any new environment as a one-time seed.
 *
 * Run with:
 *   pnpm db:seed
 *
 * What this script creates:
 *   - All four platform subscription plans (Free / Starter / Gold / Platinum).
 *     The plan-picker UI references these by slug, so missing plans break the
 *     organization signup and billing flows.
 *   - One bootstrap organization linked to the Free plan.
 *   - One admin user with email-only login (no password) so a human can sign in
 *     and start configuring the org.
 *
 * Scope boundary — what does NOT belong in this file:
 *   ✗ Sample organizations, athletes, programs, events, payments, fixtures of
 *     any kind. Those go in seed-dev.ts (the comprehensive dev seed) and must
 *     never be seeded into prod.
 *   ✗ Adyen account replay, Redis analytics, or any other third-party fixtures.
 *   ✗ Reserved-domain data — that lives in seed-reserved.ts and is unrelated.
 *
 * If you find yourself adding a fixture here, ask: would the app fail to boot
 * or log in without it? If no, it belongs in seed-dev.ts instead.
 *
 * See also: docs/SEEDING.md
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BOOTSTRAP_ORG_ID = "seed-bootstrap-org";
const BOOTSTRAP_ADMIN_EMAIL = "admin@bootstrap.local";

async function main() {
  console.log("🌱 Starting bootstrap seed...\n");

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================
  // The plan-picker UI references plans by slug. Missing plans break signup.
  console.log("📋 Creating subscription plans...");

  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "free" },
    update: {},
    create: {
      name: "Free",
      slug: "free",
      description: "Perfect for getting started",
      monthlyPrice: 0,
      yearlyPrice: 0,
      transactionFee: 0.05,
      perTransactionFee: 0.5,
      maxAthletes: 25,
      maxUsers: 2,
      maxPrograms: 3,
      maxEvents: 10,
      maxStorageMB: 500,
      maxMembershipTypes: 2,
      features: ["Basic scheduling", "Up to 25 athletes", "Email support", "500 MB storage"],
      featureToggles: {
        events: false,
        sms: false,
        emailCampaigns: false,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: false,
        memberships: false,
        waitlists: false,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 0,
      isActive: true,
      isPublic: true,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter",
      slug: "starter",
      description: "For growing organizations",
      monthlyPrice: 49,
      yearlyPrice: 470,
      transactionFee: 0.035,
      perTransactionFee: 0.35,
      maxAthletes: 100,
      maxUsers: 5,
      maxPrograms: 10,
      maxEvents: 50,
      smsIncluded: 100,
      smsOverageRate: 0.05,
      emailIncluded: 500,
      emailOverageRate: 0.005,
      maxStorageMB: 2000,
      maxMembershipTypes: 5,
      features: [
        "Advanced scheduling",
        "Up to 100 athletes",
        "Priority email support",
        "Basic reporting",
        "500 email campaigns/month",
        "2 GB storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: false,
        accountingIntegrations: false,
        training: false,
        store: true,
        memberships: false,
        waitlists: true,
        passes: false,
        seasons: false,
        liveSupport: false,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 1,
      isActive: true,
      isPublic: true,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "gold" },
    update: {},
    create: {
      name: "Gold",
      slug: "gold",
      description: "Most popular for established clubs",
      monthlyPrice: 149,
      yearlyPrice: 1430,
      transactionFee: 0.029,
      perTransactionFee: 0.3,
      maxAthletes: 500,
      maxUsers: 15,
      maxPrograms: 50,
      maxEvents: null,
      smsIncluded: 500,
      smsOverageRate: 0.04,
      emailIncluded: 2500,
      emailOverageRate: 0.003,
      maxStorageMB: 10000,
      maxMembershipTypes: 15,
      features: [
        "Unlimited events",
        "Up to 500 athletes",
        "Phone support",
        "Advanced reporting",
        "Custom branding",
        "2,500 email campaigns/month",
        "10 GB storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: false,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
      },
      isPopular: true,
      displayOrder: 2,
      isActive: true,
      isPublic: true,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { slug: "platinum" },
    update: {},
    create: {
      name: "Platinum",
      slug: "platinum",
      description: "Enterprise-grade solution",
      monthlyPrice: 349,
      yearlyPrice: 3350,
      transactionFee: 0.025,
      perTransactionFee: 0.25,
      maxAthletes: null,
      maxUsers: null,
      maxPrograms: null,
      maxEvents: null,
      smsIncluded: 2000,
      smsOverageRate: 0.03,
      emailIncluded: 10000,
      emailOverageRate: 0.002,
      maxStorageMB: null,
      maxMembershipTypes: null,
      features: [
        "Unlimited everything",
        "Dedicated support",
        "Custom integrations",
        "White-label options",
        "SLA guarantee",
        "10,000 email campaigns/month",
        "Unlimited storage",
      ],
      featureToggles: {
        events: true,
        sms: true,
        emailCampaigns: true,
        customDomains: true,
        accountingIntegrations: true,
        training: true,
        store: true,
        memberships: false,
        waitlists: true,
        passes: true,
        seasons: false,
        liveSupport: true,
        customInformation: true,
        analytics: false,
      },
      isPopular: false,
      displayOrder: 3,
      isActive: true,
      isPublic: true,
    },
  });
  console.log("  ✓ Created 4 subscription plans");

  // ============================================
  // ORGANIZATION
  // ============================================
  console.log("\n🏢 Creating bootstrap organization...");
  const org = await prisma.organization.upsert({
    where: { id: BOOTSTRAP_ORG_ID },
    update: {},
    create: {
      id: BOOTSTRAP_ORG_ID,
      name: "Bootstrap Organization",
      slug: "bootstrap",
      email: "contact@bootstrap.local",
      country: "US",
    },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.organizationSubscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: freePlan.id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  console.log(`  ✓ Created org "${org.name}" on Free plan`);

  // ============================================
  // ADMIN USER
  // ============================================
  // Email-only login (no passwordHash) — sign in via magic link / login code.
  console.log("\n👤 Creating admin user...");
  const admin = await prisma.user.upsert({
    where: { email: BOOTSTRAP_ADMIN_EMAIL },
    update: {},
    create: {
      email: BOOTSTRAP_ADMIN_EMAIL,
      name: "Bootstrap Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: admin.id } },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      organizationId: org.id,
      userId: admin.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`  ✓ Created admin ${admin.email} (org ADMIN)`);

  console.log("\n" + "=".repeat(50));
  console.log("🎉 Bootstrap seed completed.");
  console.log("=".repeat(50));
  console.log(`\nLog in at /login with email: ${BOOTSTRAP_ADMIN_EMAIL}`);
}

main()
  .catch((e) => {
    console.error("❌ Bootstrap seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
