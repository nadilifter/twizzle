import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

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
