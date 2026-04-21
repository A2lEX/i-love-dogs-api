import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const email = 'curator@local.ru';
  
  const user = await prisma.user.update({
    where: { email },
    data: { role: 'curator' }
  });

  console.log(`User ${email} updated to curator role.`);
  
  // Ensure curator profile exists
  const profile = await prisma.curatorProfile.upsert({
    where: { user_id: user.id },
    update: { verify_status: 'verified' },
    create: {
      user_id: user.id,
      shelter_name: 'Test Shelter',
      city: 'Moscow',
      verify_status: 'verified'
    }
  });
  
  console.log(`Curator profile for ${email} ensured and verified.`);

  await prisma.$disconnect();
}

main();
