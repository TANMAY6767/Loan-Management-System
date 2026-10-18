import { prisma } from '../config/prisma.js';

const INDIA_OFFSET_MINUTES = 330;

export function startOfTodayInIndia(now = new Date()) {
  const indiaTime = new Date(
    now.getTime() + INDIA_OFFSET_MINUTES * 60 * 1000
  );

  return new Date(
    Date.UTC(
      indiaTime.getUTCFullYear(),
      indiaTime.getUTCMonth(),
      indiaTime.getUTCDate()
    ) - INDIA_OFFSET_MINUTES * 60 * 1000
  );
}

export function isPastCalendarDateInIndia(date, now = new Date()) {
  return date < startOfTodayInIndia(now);
}

export async function markOverduePromises(accountScope, now = new Date()) {
  return prisma.pTP.updateMany({
    where: {
      status: 'Pending',
      dueDate: { lt: startOfTodayInIndia(now) },
      account: { is: accountScope },
    },
    data: { status: 'Broken' },
  });
}
