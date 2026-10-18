import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../'
);

const SEED_DATA_DIR = path.join(root, 'seed-data');
const DEFAULT_PASSWORD = 'shaha123';

async function readCsv(filename) {
  const filePath = path.join(SEED_DATA_DIR, filename);
  const content = await readFile(filePath, 'utf8');

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
}

function isResetMode() {
  return process.argv.includes('--reset');
}

async function resetDemoAccounts() {
  console.log('Clearing demo accounts and account activity...');

  // Delete dependent records before deleting their accounts.
  await prisma.payment.deleteMany();
  await prisma.pTP.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.account.deleteMany();

  console.log('Demo accounts and account activity cleared.');
}

async function seedOffices(users) {
  const officeNames = new Set(users.map((user) => user.office));

  for (const name of officeNames) {
    await prisma.office.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const offices = await prisma.office.findMany();

  return new Map(
    offices.map((office) => [office.name, office.id])
  );
}

async function seedUsers(users, officeMap) {
  const hashedPassword = await bcrypt.hash(
    DEFAULT_PASSWORD,
    10
  );

  for (const user of users) {
    const officeId = officeMap.get(user.office);

    if (!officeId) {
      throw new Error(
        `Office "${user.office}" not found for user ${user.user_id}`
      );
    }

    const userData = {
      name: user.name,
      role: user.role,
      officeId,
      managerId: user.manager_id || null,
    };

    await prisma.user.upsert({
      where: { id: user.user_id },

      update: userData,

      create: {
        id: user.user_id,
        username:
          user.username || user.user_id.toLowerCase(),
        password: hashedPassword,
        ...userData,
      },
    });
  }

  console.log(`${users.length} users processed.`);
}

async function main() {
  console.log('Loading demo users...');
  const users = await readCsv('users_seed.csv');
  console.log(`CSV loaded: ${users.length} users.`);

  if (isResetMode()) {
    await resetDemoAccounts();
  }

  const officeMap = await seedOffices(users);
  await seedUsers(users, officeMap);

  console.log('User seed completed successfully.');
  console.log(
    `Demo password for newly created users: ${DEFAULT_PASSWORD}`
  );
}

try {
  await main();
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
