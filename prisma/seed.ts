import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter });



async function main() {
  console.log('Seeding data...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dogcare.ru' },
    update: {},
    create: {
      email: 'admin@dogcare.ru',
      name: 'Admin User',
      password_hash: adminPassword,
      role: 'admin',
      status: 'active',
    },
  });
  console.log(`Admin user created: ${admin.id}`);

  // Create curator user and profile
  const curatorPassword = await bcrypt.hash('Curator123!', 10);
  const curator = await prisma.user.upsert({
    where: { email: 'curator@local.ru' },
    update: {},
    create: {
      email: 'curator@local.ru',
      name: 'Test Curator',
      password_hash: curatorPassword,
      role: 'curator',
      status: 'active',
      curator_profile: {
        create: {
          shelter_name: 'Happy Tails Shelter',
          city: 'Moscow',
          verify_status: 'verified',
        },
      },
    },
  });
  console.log(`Curator user created: ${curator.id}`);

  // Fetch curator profile
  const curatorProfile = await prisma.curatorProfile.findUnique({
    where: { user_id: curator.id },
  });

  if (!curatorProfile) throw new Error('Failed to create curator profile');

  // Create 3 dogs
  const dogs = await Promise.all([
    prisma.dog.create({
      data: {
        name: 'Rex',
        breed: 'German Shepherd',
        age_months: 24,
        gender: 'male',
        description: 'A very good boy.',
        status: 'active',
        city: 'Moscow',
        curator_id: curatorProfile.id,
      },
    }),
    prisma.dog.create({
      data: {
        name: 'Bella',
        breed: 'Labrador',
        age_months: 12,
        gender: 'female',
        description: 'Loves to play fetch.',
        status: 'active',
        city: 'Moscow',
        curator_id: curatorProfile.id,
      },
    }),
    prisma.dog.create({
      data: {
        name: 'Charlie',
        breed: 'Mixed',
        age_months: 6,
        gender: 'male',
        description: 'Looking for a loving home.',
        status: 'active',
        city: 'Moscow',
        curator_id: curatorProfile.id,
      },
    }),
  ]);
  console.log(`Created ${dogs.length} dogs`);

  // Create 5 goals
  await prisma.goal.createMany({
    data: [
      {
        dog_id: dogs[0].id,
        created_by: curator.id,
        category: 'medical',
        title: 'Vaccination for Rex',
        amount_target: 300000, // in kopecks (3000 RUB)
        status: 'active',
      },
      {
        dog_id: dogs[0].id,
        created_by: curator.id,
        category: 'food',
        title: 'Monthly Food for Rex',
        amount_target: 500000,
        is_recurring: true,
        status: 'active',
      },
      {
        dog_id: dogs[1].id,
        created_by: curator.id,
        category: 'sterilization',
        title: 'Sterilization for Bella',
        amount_target: 1000000,
        status: 'active',
      },
      {
        dog_id: dogs[2].id,
        created_by: admin.id,
        category: 'medical',
        title: 'Paw treatment for Charlie',
        amount_target: 200000,
        amount_collected: 50000, // Partially collected
        status: 'active',
      },
      {
        dog_id: dogs[2].id,
        created_by: curator.id,
        category: 'food',
        title: 'Special Diet for Charlie',
        amount_target: 400000,
        is_recurring: true,
        status: 'active',
      },
    ],
  });
  console.log(`Created 5 goals`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
