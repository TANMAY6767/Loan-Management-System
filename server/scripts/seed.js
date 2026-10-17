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
const BATCH_SIZE = 1000;

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

function parseDate(value) {
  if (!value) return null;

  return new Date(`${value}T00:00:00.000Z`);
}

function isResetMode() {
  return process.argv.includes('--reset');
}

async function resetLoanData() {
  console.log('Resetting existing loan data...');

  // Delete dependent records before deleting their accounts.
  await prisma.payment.deleteMany();
  await prisma.pTP.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.account.deleteMany();

  console.log('Existing loan data cleared.');
}

async function seedOffices(users, accounts) {
  const officeNames = new Set([
    ...users.map((user) => user.office),
    ...accounts.map((account) => account.office),
  ]);

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

function mapAccountRow(row, officeMap) {
  const officeId = officeMap.get(row.office);

  if (!officeId) {
    throw new Error(
      `Office "${row.office}" not found for loan ${row.loan_no}`
    );
  }

  return {
    loanNo: row.loan_no,
    portfolio: row.portfolio,
    sellerBank: row.seller_bank,
    customerName: row.customer_name,
    mobile: row.mobile,
    email: row.email || null,
    city: row.city,
    state: row.state,
    officeId,
    language: row.language,
    product: row.product,
    originalAmount: Number(row.original_amount),
    outstanding: Number(row.outstanding),
    npaDate: parseDate(row.npa_date),
    lastPaymentDate: parseDate(row.last_payment_date),

    // Every newly seeded account starts unassigned.
    assignedToId: null,

    // The manager will assign accounts later.
    status: 'New',
  };
}

async function seedAccounts(accounts, officeMap) {
  // When resetting, the previous accounts have already been deleted.
  // Otherwise, skip loan numbers that already exist.
  const existingLoans = isResetMode()
    ? new Set()
    : new Set(
        (
          await prisma.account.findMany({
            select: { loanNo: true },
          })
        ).map((account) => account.loanNo)
      );

  const seenLoans = new Set(existingLoans);
  let imported = 0;

  for (
    let index = 0;
    index < accounts.length;
    index += BATCH_SIZE
  ) {
    const rows = accounts.slice(
      index,
      index + BATCH_SIZE
    );

    const accountRecords = [];

    for (const row of rows) {
      // Prevent duplicate loan numbers within the CSV or database.
      if (seenLoans.has(row.loan_no)) continue;

      seenLoans.add(row.loan_no);

      // No caller is selected here.
      // No allocation history is created during seeding.
      accountRecords.push(
        mapAccountRow(row, officeMap)
      );
    }

    if (accountRecords.length === 0) continue;

    const result = await prisma.account.createMany({
      data: accountRecords,
      skipDuplicates: true,
    });

    imported += result.count;

    console.log(
      `Processed batch ${Math.floor(index / BATCH_SIZE) + 1}: ` +
      `${result.count} accounts inserted.`
    );
  }

  console.log(`Accounts inserted: ${imported}`);
  console.log('New accounts have not been assigned to callers.');
}

async function main() {
  console.log('Starting database seed...');

  const [users, accounts] = await Promise.all([
    readCsv('users_seed.csv'),
    readCsv('accounts_10000.csv'),
  ]);

  console.log(
    `CSV loaded: ${users.length} users, ${accounts.length} accounts.`
  );

  if (isResetMode()) {
    await resetLoanData();
  }

  const officeMap = await seedOffices(users, accounts);

  await seedUsers(users, officeMap);

  await seedAccounts(accounts, officeMap);

  console.log('Seed completed successfully.');
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