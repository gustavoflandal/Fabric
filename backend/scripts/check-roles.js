const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.findMany();
  console.log('Roles encontradas:', JSON.stringify(roles, null, 2));
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
