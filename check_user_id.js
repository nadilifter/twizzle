
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserById() {
  const id = 'cmkqcww6f00036x5ob8pbw9c2';
  const user = await prisma.user.findUnique({
    where: { id },
    include: { permissions: true }
  });
  console.log("Checking user by ID:", id);
  console.log(JSON.stringify(user, null, 2));
  
  // Also list all users with this email
  const email = 'andrewkarzel@uplifterinc.com';
  const users = await prisma.user.findMany({
    where: { email },
    select: { id: true, email: true, isSuperAdmin: true }
  });
  console.log("Users with email:", email);
  console.log(JSON.stringify(users, null, 2));
}

checkUserById()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
