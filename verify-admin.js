
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  console.log('Admin user:', user ? 'EXISTS' : 'NOT FOUND');
  if (user) {
    console.log('Email:', user.email);
    console.log('Has password:', !!user.passwordHash);
  }
  await prisma.$disconnect();
}
check().catch(console.error);
