import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.NEW_ADMIN_EMAIL || 'admin2@fabric.com';
  const password = process.env.NEW_ADMIN_PASSWORD || 'Admin@2026!';
  const name = process.env.NEW_ADMIN_NAME || 'Administrador 2';

  if (password.length < 6) {
    throw new Error('NEW_ADMIN_PASSWORD deve ter pelo menos 6 caracteres.');
  }

  // Ensure ADMIN role exists
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      name: 'Administrador',
      active: true,
    },
    create: {
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acesso total ao sistema',
      active: true,
    },
  });

  // Ensure ADMIN role has all permissions available in the system
  const allPermissions = await prisma.permission.findMany({
    select: { id: true },
  });

  if (allPermissions.length > 0) {
    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Create or update the admin user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: passwordHash,
      active: true,
    },
    create: {
      email,
      name,
      password: passwordHash,
      active: true,
    },
  });

  // Link user to ADMIN role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  const roleCount = await prisma.userRole.count({
    where: { userId: user.id },
  });

  console.log('OK - acesso admin criado/atualizado com sucesso.');
  console.log(`Email: ${email}`);
  console.log(`Senha: ${password}`);
  console.log(`Nome: ${name}`);
  console.log(`Perfis associados ao usuario: ${roleCount}`);
}

main()
  .catch((err) => {
    console.error('ERRO ao criar acesso admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
