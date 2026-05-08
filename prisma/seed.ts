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

  // Create countries
  const meCountry = await prisma.country.upsert({
    where: { code: 'ME' },
    update: {},
    create: { code: 'ME', name: 'Montenegro', currency: 'EUR' },
  });

  const ruCountry = await prisma.country.upsert({
    where: { code: 'RU' },
    update: {},
    create: { code: 'RU', name: 'Russia', currency: 'RUB' },
  });

  const rsCountry = await prisma.country.upsert({
    where: { code: 'RS' },
    update: {},
    create: { code: 'RS', name: 'Serbia', currency: 'RSD' },
  });
  console.log('Created countries');

  // Create Montenegro cities
  const meCities = [
    { name: 'Podgorica', lat: 42.4304, lng: 19.2594 },
    { name: 'Budva', lat: 42.2863, lng: 18.8400 },
    { name: 'Bar', lat: 42.0932, lng: 19.0984 },
    { name: 'Herceg Novi', lat: 42.4531, lng: 18.5375 },
    { name: 'Kotor', lat: 42.4246, lng: 18.7712 },
    { name: 'Tivat', lat: 42.4364, lng: 18.6961 },
    { name: 'Nikšić', lat: 42.7731, lng: 18.9445 },
    { name: 'Cetinje', lat: 42.3933, lng: 18.9116 },
    { name: 'Bijelo Polje', lat: 43.0383, lng: 19.7476 },
    { name: 'Ulcinj', lat: 41.9311, lng: 19.2155 },
  ];

  // Proper way to seed cities to avoid unique constraint issues with nullable state
  for (const city of meCities) {
    let existing = await prisma.city.findFirst({
      where: { name: city.name, country_id: meCountry.id },
    });
    if (!existing) {
      await prisma.city.create({
        data: { name: city.name, lat: city.lat, lng: city.lng, country_id: meCountry.id },
      });
    }
  }
  console.log(`Created ${meCities.length} Montenegro cities`);

  // Also add Moscow for existing data compatibility
  let moscow = await prisma.city.findFirst({
    where: { name: 'Moscow', country_id: ruCountry.id },
  });
  if (!moscow) {
    moscow = await prisma.city.create({
      data: { name: 'Moscow', lat: 55.7558, lng: 37.6173, country_id: ruCountry.id },
    });
  }

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
          city: 'Podgorica',
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

  const podgorica = await prisma.city.findFirst({
    where: { name: 'Podgorica', country_id: meCountry.id },
  });

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
        city_id: podgorica?.id,
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
        city_id: podgorica?.id,
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
        city_id: podgorica?.id,
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
