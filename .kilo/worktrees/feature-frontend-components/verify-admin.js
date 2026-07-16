
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const user = await prisma.user.findUnique({ 
    where: { email: 'yohanes.senbeto@ethiotelecom.et' },
    include: { role: true }
  });
  console.log('Admin user:', user ? 'EXISTS' : 'NOT FOUND');
  if (user) {
    console.log('Role:', user.role?.displayName);
    console.log('Has password:', docker imagesuser.passwordHash);
  }
  await prisma.$disconnect();
}
check().catch(console.error);

