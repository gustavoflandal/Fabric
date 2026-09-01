import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Resetando senha do administrador...\n');

  // Buscar usuário admin
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@fabric.com' },
  });

  if (!admin) {
    console.error('❌ Usuário admin@fabric.com não encontrado!');
    console.log('\n💡 Execute primeiro: npm run prisma:seed');
    process.exit(1);
  }

  // Gerar nova senha
  const newPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Atualizar senha
  await prisma.user.update({
    where: { email: 'admin@fabric.com' },
    data: { password: hashedPassword },
  });

  console.log('✅ Senha resetada com sucesso!\n');
  console.log('📧 Email: admin@fabric.com');
  console.log('🔑 Senha: admin123\n');
  console.log('Agora você pode fazer login com essas credenciais.');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao resetar senha:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
