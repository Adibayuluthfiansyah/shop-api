import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding categories...');

  const categories = [
    { name: 'Electronics' },
    { name: 'Fashion' },
    { name: 'Books' },
    { name: 'Home & Garden' },
    { name: 'Sports & Outdoors' },
    { name: 'Toys & Games' },
    { name: 'Beauty & Health' },
    { name: 'Food & Beverages' },
  ];

  for (const category of categories) {
    const existing = await prisma.category.findFirst({
      where: { name: category.name },
    });

    if (!existing) {
      await prisma.category.create({
        data: category,
      });
      console.log(`✓ Created category: ${category.name}`);
    } else {
      console.log(`- Category already exists: ${category.name}`);
    }
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
