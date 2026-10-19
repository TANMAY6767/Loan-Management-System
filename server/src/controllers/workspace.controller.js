import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import { accountScope } from '../utils/accountScope.js';
import { markOverduePromises } from '../utils/promiseStatus.js';

const money = (value) => Number(value || 0);
const INDIA_OFFSET_MS = 330 * 60 * 1000;

function indiaPeriodStart(now, month = false) {
  const indiaDate = new Date(now.getTime() + INDIA_OFFSET_MS);
  return new Date(Date.UTC(
    indiaDate.getUTCFullYear(),
    indiaDate.getUTCMonth(),
    month ? 1 : indiaDate.getUTCDate(),
  ) - INDIA_OFFSET_MS);
}

export const getTeam = asyncHandler(async (req, res) => {
  const where = ['head', 'coo'].includes(req.user.role)
    ? {}
    : req.user.role === 'manager'
      ? { managerId: req.user.id }
      : req.user.role === 'caller'
        ? { id: req.user.id }
        : { role: 'caller', officeId: req.user.officeId };

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      officeId: true,
      managerId: true,
      office: { select: { name: true } },
      _count: { select: { accounts: true } },
    },
  });

  return sendResponse(res, true, users, 'Team loaded.');
});

export const getDashboard = asyncHandler(async (req, res) => {
  await markOverduePromises(accountScope(req.user));

  const scope = accountScope(req.user);
  const [accounts, people, pendingPromises] = await Promise.all([
    prisma.account.findMany({
      where: scope,
      select: { loanNo: true, outstanding: true, status: true, assignedToId: true },
    }),
    prisma.user.count({
      where: ['head', 'coo'].includes(req.user.role)
        ? { role: 'caller' }
        : req.user.role === 'manager'
          ? { role: 'caller', managerId: req.user.id }
          : { id: req.user.id },
    }),
    prisma.pTP.count({ where: { status: 'Pending', account: { is: scope } } }),
  ]);

  const statuses = Object.fromEntries(
    ['New', 'Working', 'PTP', 'Part_paid', 'Closed', 'Settled'].map((status) => [status, 0]),
  );
  let totalOutstanding = 0;
  let assigned = 0;
  accounts.forEach((account) => {
    statuses[account.status] += 1;
    totalOutstanding += money(account.outstanding);
    if (account.assignedToId) assigned += 1;
  });

  const accountIds = accounts.map((account) => account.loanNo);
  const now = new Date();
  const monthStart = indiaPeriodStart(now, true);
  const todayStart = indiaPeriodStart(now);
  const [paymentTotals, monthPayments, todayPayments, paidByAccount] = accountIds.length
    ? await Promise.all([
        prisma.payment.aggregate({ where: { accountId: { in: accountIds } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { accountId: { in: accountIds }, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { accountId: { in: accountIds }, paidAt: { gte: todayStart } }, _sum: { amount: true } }),
        prisma.payment.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _sum: { amount: true } }),
      ])
    : [null, null, null, []];
  const totalPaid = money(paymentTotals?._sum.amount);
  const paidLookup = new Map(paidByAccount.map((item) => [item.accountId, money(item._sum.amount)]));
  const remainingBalance = accounts.reduce((remaining, account) => {
    if (['Closed', 'Settled'].includes(account.status)) return remaining;
    return remaining + Math.max(0, money(account.outstanding) - (paidLookup.get(account.loanNo) || 0));
  }, 0);

  const recent = await prisma.callLog.findMany({
    where: { account: { is: scope } },
    include: {
      account: { select: { loanNo: true, customerName: true } },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 7,
  });

  return sendResponse(res, true, {
    totalAccounts: accounts.length,
    totalOutstanding,
    totalPaid,
    monthCollected: money(monthPayments?._sum.amount),
    todayCollected: money(todayPayments?._sum.amount),
    remainingBalance,
    assigned,
    unassigned: accounts.length - assigned,
    callers: people,
    pendingPromises,
    statuses,
    recent,
  }, 'Dashboard loaded.');
});
