import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import { accountScope } from '../utils/accountScope.js';
import { markOverduePromises } from '../utils/promiseStatus.js';

const money = (value) => Number(value || 0);

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

  const paymentTotals = accounts.length
    ? await prisma.payment.aggregate({
        where: { accountId: { in: accounts.map((account) => account.loanNo) } },
        _sum: { amount: true },
      })
    : null;
  const totalPaid = money(paymentTotals?._sum.amount);
  const remainingBalance = Math.max(0, totalOutstanding - totalPaid);

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
    remainingBalance,
    assigned,
    unassigned: accounts.length - assigned,
    callers: people,
    pendingPromises,
    statuses,
    recent,
  }, 'Dashboard loaded.');
});
