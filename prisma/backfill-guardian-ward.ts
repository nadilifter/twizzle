import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Guardian/Ward backfill...");

  const families = await prisma.family.findMany({
    where: { userId: { not: null } },
    select: { id: true, userId: true },
  });

  console.log(
    `Found ${families.length} families with linked user accounts to backfill.`
  );

  let guardianCount = 0;
  let invoiceCount = 0;
  let paymentCount = 0;
  let enrollmentCount = 0;
  let instanceRegCount = 0;
  let recurringChargeCount = 0;
  let smsMessageCount = 0;
  let smsConversationCount = 0;
  let emailMessageCount = 0;
  let waiverSigCount = 0;
  let waiverAccCount = 0;
  let paymentMethodCount = 0;

  for (const family of families) {
    const userId = family.userId!;

    const guardianResult = await prisma.athleteGuardian.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    guardianCount += guardianResult.count;

    const invoiceResult = await prisma.invoice.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    invoiceCount += invoiceResult.count;

    const paymentResult = await prisma.payment.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    paymentCount += paymentResult.count;

    const enrollmentResult = await prisma.enrollment.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    enrollmentCount += enrollmentResult.count;

    const instanceRegResult = await prisma.instanceRegistration.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    instanceRegCount += instanceRegResult.count;

    const recurringResult = await prisma.recurringCharge.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    recurringChargeCount += recurringResult.count;

    const smsResult = await prisma.smsMessage.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    smsMessageCount += smsResult.count;

    const smsConvResult = await prisma.smsConversation.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    smsConversationCount += smsConvResult.count;

    const emailResult = await prisma.emailMessage.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    emailMessageCount += emailResult.count;

    const waiverSigResult = await prisma.waiverSignature.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    waiverSigCount += waiverSigResult.count;

    const waiverAccResult = await prisma.waiverAcceptance.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    waiverAccCount += waiverAccResult.count;

    const pmResult = await prisma.paymentMethod.updateMany({
      where: { familyId: family.id, userId: null },
      data: { userId },
    });
    paymentMethodCount += pmResult.count;
  }

  // Backfill User.balance from Family.balance
  let balanceCount = 0;
  const familiesWithBalances = await prisma.family.findMany({
    where: { userId: { not: null }, balance: { not: 0 } },
    select: { userId: true, balance: true },
  });

  for (const family of familiesWithBalances) {
    await prisma.user.update({
      where: { id: family.userId! },
      data: { balance: family.balance },
    });
    balanceCount++;
  }

  console.log("Backfill complete:");
  console.log(`  AthleteGuardian: ${guardianCount} records updated`);
  console.log(`  Invoice: ${invoiceCount} records updated`);
  console.log(`  Payment: ${paymentCount} records updated`);
  console.log(`  Enrollment: ${enrollmentCount} records updated`);
  console.log(`  InstanceRegistration: ${instanceRegCount} records updated`);
  console.log(`  RecurringCharge: ${recurringChargeCount} records updated`);
  console.log(`  SmsMessage: ${smsMessageCount} records updated`);
  console.log(`  SmsConversation: ${smsConversationCount} records updated`);
  console.log(`  EmailMessage: ${emailMessageCount} records updated`);
  console.log(`  WaiverSignature: ${waiverSigCount} records updated`);
  console.log(`  WaiverAcceptance: ${waiverAccCount} records updated`);
  console.log(`  PaymentMethod: ${paymentMethodCount} records updated`);
  console.log(`  User balance: ${balanceCount} records updated`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
