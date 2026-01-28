import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create Subscription Plans
  console.log("Creating subscription plans...");
  
  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "free" },
    update: {},
    create: {
      name: "Free",
      slug: "free",
      description: "Perfect for getting started with basic club management",
      monthlyPrice: 0,
      yearlyPrice: 0,
      transactionFee: 0.05, // 5%
      perTransactionFee: 0.50,
      maxAthletes: 25,
      maxUsers: 2,
      maxEvents: 5,
      features: [
        "Up to 25 athletes",
        "Basic scheduling",
        "Email support",
        "Public website",
      ],
      isPopular: false,
      displayOrder: 0,
      isActive: true,
      isPublic: true,
    },
  });

  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter",
      slug: "starter",
      description: "Ideal for small clubs ready to grow",
      monthlyPrice: 29,
      yearlyPrice: 290,
      transactionFee: 0.04, // 4%
      perTransactionFee: 0.40,
      maxAthletes: 100,
      maxUsers: 5,
      maxEvents: 20,
      features: [
        "Up to 100 athletes",
        "5 staff accounts",
        "Event management",
        "Online payments",
        "Email support",
        "Custom branding",
      ],
      isPopular: false,
      displayOrder: 1,
      isActive: true,
      isPublic: true,
    },
  });

  const goldPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "gold" },
    update: {},
    create: {
      name: "Gold",
      slug: "gold",
      description: "For established clubs with growing needs",
      monthlyPrice: 79,
      yearlyPrice: 790,
      transactionFee: 0.03, // 3%
      perTransactionFee: 0.30,
      maxAthletes: 500,
      maxUsers: 15,
      maxEvents: null, // Unlimited
      features: [
        "Up to 500 athletes",
        "15 staff accounts",
        "Unlimited events",
        "Advanced analytics",
        "Priority support",
        "Custom domain",
        "Point of Sale",
      ],
      isPopular: true,
      displayOrder: 2,
      isActive: true,
      isPublic: true,
    },
  });

  const platinumPlan = await prisma.subscriptionPlan.upsert({
    where: { slug: "platinum" },
    update: {},
    create: {
      name: "Platinum",
      slug: "platinum",
      description: "Enterprise-grade solution for large organizations",
      monthlyPrice: 199,
      yearlyPrice: 1990,
      transactionFee: 0.025, // 2.5%
      perTransactionFee: 0.25,
      maxAthletes: null, // Unlimited
      maxUsers: null, // Unlimited
      maxEvents: null, // Unlimited
      features: [
        "Unlimited athletes",
        "Unlimited staff accounts",
        "Unlimited events",
        "Advanced analytics",
        "Dedicated support",
        "Custom domain",
        "Point of Sale",
        "API access",
        "White-label options",
      ],
      isPopular: false,
      displayOrder: 3,
      isActive: true,
      isPublic: true,
    },
  });

  console.log("Created subscription plans:", freePlan.name, starterPlan.name, goldPlan.name, platinumPlan.name);

  // 1. Create "Demo Gymnastics Club" Organization
  const org = await prisma.organization.upsert({
    where: { slug: "demo-gym" },
    update: {},
    create: {
      name: "Demo Gymnastics Club",
      slug: "demo-gym",
    },
  });

  console.log("Created organization:", org.name);

  // Common password
  const hashedPassword = await bcrypt.hash("password123", 12);

  // 2. Create "Uplifter" Organization
  const uplifterOrg = await prisma.organization.upsert({
    where: { slug: "uplifter" },
    update: {},
    create: {
      name: "Uplifter",
      slug: "uplifter",
    },
  });
  console.log("Created organization:", uplifterOrg.name);

  // 3. Create Andrew Karzel user for Uplifter
  const andrewUser = await prisma.user.upsert({
    where: { email: "andrewkarzel@uplifterinc.com" },
    update: {
      isSuperAdmin: true,
      // Don't try to update memberships here, do it after
    },
    create: {
      email: "andrewkarzel@uplifterinc.com",
      name: "Andrew Karzel",
      passwordHash: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: uplifterOrg.id,
      isSuperAdmin: true,
      permissions: {
        create: [{ permission: "*" }],
      },
    },
  });
  console.log("Created user:", andrewUser.email);
  
  // Ensure memberships exist
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: uplifterOrg.id,
        userId: andrewUser.id,
      },
    },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      organizationId: uplifterOrg.id,
      userId: andrewUser.id,
      role: "ADMIN",
      status: "ACTIVE"
    },
  });

  // Also add Andrew to Demo Gym for testing switching
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: andrewUser.id,
      },
    },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      organizationId: org.id,
      userId: andrewUser.id,
      role: "ADMIN",
      status: "ACTIVE"
    },
  });

  // 4. Create Demo Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {
        organizationId: org.id
    },
    create: {
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash: hashedPassword,
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: org.id,
      permissions: {
        create: [{ permission: "*" }],
      },
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: adminUser.id,
      },
    },
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      organizationId: org.id,
      userId: adminUser.id,
      role: "ADMIN",
      status: "ACTIVE"
    },
  });

  console.log("Created admin user:", adminUser.email);

  // 5. Create Demo Coach User
  const coachUser = await prisma.user.upsert({
    where: { email: "coach@demo.com" },
    update: {
        organizationId: org.id
    },
    create: {
      email: "coach@demo.com",
      name: "Sarah Coach",
      passwordHash: hashedPassword,
      role: "COACH",
      status: "ACTIVE",
      organizationId: org.id,
      permissions: {
        create: [
          { permission: "dashboard.view" },
          { permission: "athletes.view" },
          { permission: "athletes.edit" },
          { permission: "training.view" },
          { permission: "training.create" },
          { permission: "training.edit" },
          { permission: "events.view" },
          { permission: "events.create" },
          { permission: "events.edit" },
        ],
      },
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: coachUser.id,
      },
    },
    update: { role: "COACH", status: "ACTIVE" },
    create: {
      organizationId: org.id,
      userId: coachUser.id,
      role: "COACH",
      status: "ACTIVE"
    },
  });

  console.log("Created coach user:", coachUser.email);

  // Create programs
  const programs = await Promise.all([
    prisma.program.upsert({
      where: { id: "prog-rec-bronze" },
      update: {},
      create: {
        id: "prog-rec-bronze",
        name: "Recreational - Bronze",
        description: "Beginner recreational program",
        level: "Bronze",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.program.upsert({
      where: { id: "prog-rec-silver" },
      update: {},
      create: {
        id: "prog-rec-silver",
        name: "Recreational - Silver",
        description: "Intermediate recreational program",
        level: "Silver",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.program.upsert({
      where: { id: "prog-jo-4" },
      update: {},
      create: {
        id: "prog-jo-4",
        name: "JO - Level 4",
        description: "Junior Olympic Level 4",
        level: "Level 4",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.program.upsert({
      where: { id: "prog-preschool" },
      update: {},
      create: {
        id: "prog-preschool",
        name: "Preschool",
        description: "Ages 3-5 introduction to gymnastics",
        level: "Preschool",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Created programs:", programs.length);

  // Create families and athletes
  const family1 = await prisma.family.upsert({
    where: { id: "fam-1" },
    update: {},
    create: {
      id: "fam-1",
      name: "Smith Family",
      primaryContact: "John Smith",
      email: "smith.family@example.com",
      phone: "(555) 123-4567",
      address: "123 Main St, Anytown, USA",
      organizationId: org.id,
    },
  });

  const family2 = await prisma.family.upsert({
    where: { id: "fam-2" },
    update: {},
    create: {
      id: "fam-2",
      name: "Johnson Family",
      primaryContact: "Sarah Johnson",
      email: "johnson.family@example.com",
      phone: "(555) 987-6543",
      address: "456 Oak Ave, Anytown, USA",
      organizationId: org.id,
    },
  });

  console.log("Created families");

  // Create athletes
  const athletes = await Promise.all([
    prisma.athlete.upsert({
      where: { id: "ath-1" },
      update: {},
      create: {
        id: "ath-1",
        name: "Emma Smith",
        email: "emma@example.com",
        level: "Bronze",
        group: "Group A",
        status: "ACTIVE",
        familyId: family1.id,
      },
    }),
    prisma.athlete.upsert({
      where: { id: "ath-2" },
      update: {},
      create: {
        id: "ath-2",
        name: "Olivia Smith",
        email: "olivia@example.com",
        level: "Silver",
        group: "Group B",
        status: "ACTIVE",
        familyId: family1.id,
      },
    }),
    prisma.athlete.upsert({
      where: { id: "ath-3" },
      update: {},
      create: {
        id: "ath-3",
        name: "Ava Johnson",
        level: "Level 4",
        group: "JO Team",
        status: "ACTIVE",
        familyId: family2.id,
      },
    }),
  ]);

  console.log("Created athletes:", athletes.length);

  // Create enrollments
  await Promise.all([
    prisma.enrollment.upsert({
      where: { id: "enr-1" },
      update: {},
      create: {
        id: "enr-1",
        athleteId: "ath-1",
        programId: "prog-rec-bronze",
        startDate: new Date("2024-01-01"),
        status: "ACTIVE",
      },
    }),
    prisma.enrollment.upsert({
      where: { id: "enr-2" },
      update: {},
      create: {
        id: "enr-2",
        athleteId: "ath-2",
        programId: "prog-rec-silver",
        startDate: new Date("2024-01-01"),
        status: "ACTIVE",
      },
    }),
    prisma.enrollment.upsert({
      where: { id: "enr-3" },
      update: {},
      create: {
        id: "enr-3",
        athleteId: "ath-3",
        programId: "prog-jo-4",
        startDate: new Date("2024-01-01"),
        status: "ACTIVE",
      },
    }),
  ]);

  console.log("Created enrollments");

  // Create skills
  const skills = await Promise.all([
    prisma.skill.upsert({
      where: { id: "skill-1" },
      update: {},
      create: {
        id: "skill-1",
        name: "Cartwheel",
        category: "Floor",
        level: "Bronze",
        description: "Basic cartwheel with proper form",
        organizationId: org.id,
      },
    }),
    prisma.skill.upsert({
      where: { id: "skill-2" },
      update: {},
      create: {
        id: "skill-2",
        name: "Forward Roll",
        category: "Floor",
        level: "Bronze",
        description: "Forward roll with tucked position",
        organizationId: org.id,
      },
    }),
    prisma.skill.upsert({
      where: { id: "skill-3" },
      update: {},
      create: {
        id: "skill-3",
        name: "Pullover",
        category: "Bars",
        level: "Bronze",
        description: "Basic pullover on bars",
        organizationId: org.id,
      },
    }),
    prisma.skill.upsert({
      where: { id: "skill-4" },
      update: {},
      create: {
        id: "skill-4",
        name: "Handstand",
        category: "Floor",
        level: "Silver",
        description: "Controlled handstand hold",
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Created skills:", skills.length);

  // Create sample events
  const today = new Date();
  await Promise.all([
    prisma.event.upsert({
      where: { id: "event-1" },
      update: {},
      create: {
        id: "event-1",
        title: "Bronze Class - Monday",
        date: today,
        startTime: "16:00",
        endTime: "17:00",
        type: "CLASS",
        programId: "prog-rec-bronze",
        coachId: coachUser.id,
        organizationId: org.id,
      },
    }),
    prisma.event.upsert({
      where: { id: "event-2" },
      update: {},
      create: {
        id: "event-2",
        title: "Silver Class - Monday",
        date: today,
        startTime: "17:00",
        endTime: "18:30",
        type: "CLASS",
        programId: "prog-rec-silver",
        coachId: coachUser.id,
        organizationId: org.id,
      },
    }),
    prisma.event.upsert({
      where: { id: "event-3" },
      update: {},
      create: {
        id: "event-3",
        title: "JO Practice",
        date: today,
        startTime: "18:30",
        endTime: "21:00",
        type: "CLASS",
        programId: "prog-jo-4",
        coachId: coachUser.id,
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Created events");

  // Create sample invoice
  await prisma.invoice.upsert({
    where: { id: "inv-1" },
    update: {},
    create: {
      id: "inv-1",
      reference: "INV-2024-00001",
      familyId: family1.id,
      status: "SENT",
      dueDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 150.0,
      total: 150.0,
      notes: "January tuition",
      organizationId: org.id,
      lineItems: {
        create: [
          {
            description: "Recreational Bronze - January",
            quantity: 1,
            unitPrice: 75.0,
            total: 75.0,
            programId: "prog-rec-bronze",
            athleteId: "ath-1",
          },
          {
            description: "Recreational Silver - January",
            quantity: 1,
            unitPrice: 75.0,
            total: 75.0,
            programId: "prog-rec-silver",
            athleteId: "ath-2",
          },
        ],
      },
    },
  });

  console.log("Created sample invoice");

  // Create sample discounts
  const discounts = await Promise.all([
    prisma.discount.upsert({
      where: { id: "discount-1" },
      update: {},
      create: {
        id: "discount-1",
        name: "New Member Discount",
        code: "WELCOME10",
        type: "PERCENTAGE",
        amount: 10,
        validFrom: new Date("2024-01-01"),
        validTo: new Date("2026-12-31"),
        userScope: "NEW_USERS",
        productScope: "ALL",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.discount.upsert({
      where: { id: "discount-2" },
      update: {},
      create: {
        id: "discount-2",
        name: "Summer Camp Early Bird",
        code: "SUMMERCAMP25",
        type: "FIXED_AMOUNT",
        amount: 25,
        validFrom: new Date("2024-03-01"),
        validTo: new Date("2024-06-01"),
        userScope: "ALL",
        productScope: "EVENTS",
        usageLimit: 50,
        status: "EXPIRED",
        organizationId: org.id,
      },
    }),
    prisma.discount.upsert({
      where: { id: "discount-3" },
      update: {},
      create: {
        id: "discount-3",
        name: "VIP Member Discount",
        code: "VIP15",
        type: "PERCENTAGE",
        amount: 15,
        validFrom: new Date("2024-01-01"),
        userScope: "VIP",
        productScope: "ALL",
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.discount.upsert({
      where: { id: "discount-4" },
      update: {},
      create: {
        id: "discount-4",
        name: "Refer a Friend",
        code: "REFER20",
        type: "FIXED_AMOUNT",
        amount: 20,
        validFrom: new Date("2024-01-01"),
        validTo: new Date("2025-12-31"),
        userScope: "MEMBERS",
        productScope: "MEMBERSHIP",
        usageLimit: 100,
        usageCount: 23,
        status: "ACTIVE",
        organizationId: org.id,
      },
    }),
    prisma.discount.upsert({
      where: { id: "discount-5" },
      update: {},
      create: {
        id: "discount-5",
        name: "Spring Sale 2025",
        code: "SPRING2025",
        type: "PERCENTAGE",
        amount: 20,
        validFrom: new Date("2025-03-01"),
        validTo: new Date("2025-04-30"),
        userScope: "ALL",
        productScope: "ALL",
        status: "SCHEDULED",
        organizationId: org.id,
      },
    }),
  ]);

  console.log("Created discounts:", discounts.length);

  // ============================================
  // Reserved Domains - System and Brand Protection
  // ============================================
  
  const reservedDomains = await Promise.all([
    // System reserved - exact matches
    prisma.reservedDomain.upsert({
      where: { pattern: "admin" },
      update: {},
      create: {
        pattern: "admin",
        type: "EXACT",
        reason: "System use - admin portal",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "api" },
      update: {},
      create: {
        pattern: "api",
        type: "EXACT",
        reason: "System use - API endpoint",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "app" },
      update: {},
      create: {
        pattern: "app",
        type: "EXACT",
        reason: "System use - application",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "www" },
      update: {},
      create: {
        pattern: "www",
        type: "EXACT",
        reason: "System use - main website",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "mail" },
      update: {},
      create: {
        pattern: "mail",
        type: "EXACT",
        reason: "System use - email services",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "help" },
      update: {},
      create: {
        pattern: "help",
        type: "EXACT",
        reason: "System use - help center",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "support" },
      update: {},
      create: {
        pattern: "support",
        type: "EXACT",
        reason: "System use - support portal",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "status" },
      update: {},
      create: {
        pattern: "status",
        type: "EXACT",
        reason: "System use - status page",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "docs" },
      update: {},
      create: {
        pattern: "docs",
        type: "EXACT",
        reason: "System use - documentation",
      },
    }),
    // Brand protection
    prisma.reservedDomain.upsert({
      where: { pattern: "uplifter" },
      update: {},
      create: {
        pattern: "uplifter",
        type: "EXACT",
        reason: "Brand protection - Uplifter trademark",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "leapfrog" },
      update: {},
      create: {
        pattern: "leapfrog",
        type: "EXACT",
        reason: "Brand protection - LeapFrog trademark",
      },
    }),
    // Prefix reserved - blocks anything starting with pattern
    prisma.reservedDomain.upsert({
      where: { pattern: "test-" },
      update: {},
      create: {
        pattern: "test-",
        type: "PREFIX",
        reason: "System use - testing environments",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "demo-" },
      update: {},
      create: {
        pattern: "demo-",
        type: "PREFIX",
        reason: "System use - demo environments",
      },
    }),
    prisma.reservedDomain.upsert({
      where: { pattern: "staging-" },
      update: {},
      create: {
        pattern: "staging-",
        type: "PREFIX",
        reason: "System use - staging environments",
      },
    }),
  ]);

  console.log("Created reserved domains:", reservedDomains.length);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
