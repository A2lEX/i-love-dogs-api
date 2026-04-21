import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const email = 'curator@local.ru';
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: { curator_profile: true }
  });

  if (!user) {
    console.log(`User ${email} not found`);
  } else {
    console.log('User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.curator_profile ? {
        id: user.curator_profile.id,
        verify_status: user.curator_profile.verify_status
      } : 'No profile'
    });
  }

  await prisma.$disconnect();
}

main();
