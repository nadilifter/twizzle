const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkUser() {
  const email = "andrewkarzel@uplifterinc.com";
  const user = await prisma.user.findUnique({
    where: { email },
    include: { permissions: true },
  });
  console.log(JSON.stringify(user, null, 2));
}

checkUser()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
