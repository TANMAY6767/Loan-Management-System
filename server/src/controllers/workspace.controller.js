import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendResponse } from '../utils/sendResponse.js';
import { ApiError } from '../utils/ApiError.js';
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

  const callerIds = users.filter((user) => user.role === 'caller').map((user) => user.id);
  const accounts = callerIds.length
    ? await prisma.account.findMany({
        where: { assignedToId: { in: callerIds } },
        select: { loanNo: true, assignedToId: true, outstanding: true, status: true },
      })
    : [];
  const accountIds = accounts.map((account) => account.loanNo);
  const paidByAccount = accountIds.length
    ? await prisma.payment.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accountIds } },
        _sum: { amount: true },
      })
    : [];
  const paidLookup = new Map(paidByAccount.map((payment) => [payment.accountId, money(payment._sum.amount)]));
  const recoveryByCaller = new Map();
  for (const account of accounts) {
    const current = recoveryByCaller.get(account.assignedToId) || {
      assignedOutstanding: 0,
      recovered: 0,
      remaining: 0,
    };
    const paid = paidLookup.get(account.loanNo) || 0;
    current.assignedOutstanding += money(account.outstanding);
    current.recovered += paid;
    if (!['Closed', 'Settled'].includes(account.status)) {
      current.remaining += Math.max(0, money(account.outstanding) - paid);
    }
    recoveryByCaller.set(account.assignedToId, current);
  }
  const team = users.map((member) => {
    if (member.role !== 'caller') return member;
    const metrics = recoveryByCaller.get(member.id) || {
      assignedOutstanding: 0,
      recovered: 0,
      remaining: 0,
    };
    return {
      ...member,
      assignedOutstanding: metrics.assignedOutstanding,
      recovered: metrics.recovered,
      remaining: metrics.remaining,
      recoveryPercent: metrics.assignedOutstanding > 0
        ? (metrics.recovered / metrics.assignedOutstanding) * 100
        : null,
    };
  });

  return sendResponse(res, true, team, 'Team loaded.');
});

export const getCallerDetails = asyncHandler(async (req, res) => {
  const caller = await prisma.user.findFirst({
    where: {
      id: req.params.callerId,
      role: 'caller',
      ...(['head', 'coo'].includes(req.user.role) ? {} : { managerId: req.user.id }),
    },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      office: { select: { name: true } },
      manager: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  if (!caller) throw new ApiError(404, 'Caller not found in your team.');

  const scope = accountScope(req.user);
  const [accounts, calls, payments, promises, allocations, settlementOffers] = await Promise.all([
    prisma.account.findMany({
      where: { assignedToId: caller.id, AND: [scope] },
      select: {
        loanNo: true,
        customerName: true,
        mobile: true,
        product: true,
        outstanding: true,
        status: true,
        office: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { customerName: 'asc' },
    }),
    prisma.callLog.findMany({
      where: { userId: caller.id, account: { is: scope } },
      select: { id: true, accountId: true, disposition: true, remarks: true, followUpAt: true, createdAt: true, account: { select: { customerName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.findMany({
      where: { userId: caller.id, account: { is: scope } },
      select: { id: true, accountId: true, amount: true, reference: true, notes: true, paidAt: true, account: { select: { customerName: true } } },
      orderBy: { paidAt: 'desc' },
    }),
    prisma.pTP.findMany({
      where: { userId: caller.id, account: { is: scope } },
      select: { id: true, accountId: true, amount: true, dueDate: true, status: true, createdAt: true, account: { select: { customerName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.allocation.findMany({
      where: { userId: caller.id, account: { is: scope } },
      select: { id: true, accountId: true, allocatedAt: true, allocator: { select: { name: true } }, account: { select: { customerName: true } } },
      orderBy: { allocatedAt: 'desc' },
    }),
    prisma.settlementOffer.findMany({
      where: { requestedById: caller.id, account: { is: scope } },
      select: { id: true, accountId: true, amount: true, status: true, createdAt: true, account: { select: { customerName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const accountIds = accounts.map((account) => account.loanNo);
  const paidByAccount = accountIds.length
    ? await prisma.payment.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accountIds } },
        _sum: { amount: true },
      })
    : [];
  const paidLookup = new Map(paidByAccount.map((payment) => [payment.accountId, money(payment._sum.amount)]));
  const assignedOutstanding = accounts.reduce((total, account) => total + money(account.outstanding), 0);
  const recovered = accounts.reduce((total, account) => total + (paidLookup.get(account.loanNo) || 0), 0);
  const remaining = accounts.reduce((total, account) => {
    if (['Closed', 'Settled'].includes(account.status)) return total;
    return total + Math.max(0, money(account.outstanding) - (paidLookup.get(account.loanNo) || 0));
  }, 0);
  const recoveryByCaller = payments.reduce((total, payment) => total + money(payment.amount), 0);

  const activity = [
    ...calls.map((item) => ({ id: `call-${item.id}`, type: 'Call', title: item.disposition, description: item.remarks, accountId: item.accountId, customerName: item.account.customerName, createdAt: item.createdAt, followUpAt: item.followUpAt })),
    ...payments.map((item) => ({ id: `payment-${item.id}`, type: 'Payment', title: `Payment recorded · ₹${money(item.amount).toLocaleString('en-IN')}`, description: item.reference || item.notes, amount: money(item.amount), accountId: item.accountId, customerName: item.account.customerName, createdAt: item.paidAt })),
    ...promises.map((item) => ({ id: `promise-${item.id}`, type: 'Promise to pay', title: `Promise recorded · ₹${money(item.amount).toLocaleString('en-IN')}`, description: `${item.status} · due ${item.dueDate.toLocaleDateString('en-IN')}`, accountId: item.accountId, customerName: item.account.customerName, createdAt: item.createdAt })),
    ...allocations.map((item) => ({ id: `allocation-${item.id}`, type: 'Allocation', title: 'Account assigned', description: `Assigned by ${item.allocator.name}`, accountId: item.accountId, customerName: item.account.customerName, createdAt: item.allocatedAt })),
    ...settlementOffers.map((item) => ({ id: `settlement-${item.id}`, type: 'Settlement request', title: `Settlement request · ${item.status}`, description: `Proposed ₹${money(item.amount).toLocaleString('en-IN')}`, amount: money(item.amount), accountId: item.accountId, customerName: item.account.customerName, createdAt: item.createdAt })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return sendResponse(res, true, {
    caller,
    accounts: accounts.map((account) => ({ ...account, paid: paidLookup.get(account.loanNo) || 0 })),
    metrics: {
      assignedAccounts: accounts.length,
      assignedOutstanding,
      recovered,
      recoveryByCaller,
      remaining,
      recoveryPercent: assignedOutstanding > 0 ? (recovered / assignedOutstanding) * 100 : null,
    },
    activity,
  }, 'Caller details loaded.');
});

export const getSettlementRequests = asyncHandler(async (req, res) => {
  const isManager = req.user.role === 'manager';
  const where = {
    status: 'Pending',
    stage: isManager ? 'Manager' : 'Head',
    account: {
      is: isManager
        ? { officeId: req.user.officeId }
        : accountScope(req.user),
    },
  };
  const [items, total] = await Promise.all([
    prisma.settlementOffer.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        account: {
          select: {
            loanNo: true,
            customerName: true,
            outstanding: true,
            status: true,
            office: { select: { name: true } },
            assignedTo: { select: { name: true, office: { select: { name: true } } } },
          },
        },
        requestedBy: { select: { id: true, name: true, office: { select: { name: true } } } },
      },
    }),
    prisma.settlementOffer.count({ where }),
  ]);

  return sendResponse(res, true, { items, total }, 'Settlement requests loaded.');
});

export const getNotifications = asyncHandler(async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { account: { select: { loanNo: true, customerName: true } } },
    }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } }),
  ]);
  return sendResponse(res, true, { items, unreadCount }, 'Notifications loaded.');
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({
    where: { id: req.params.notificationId, userId: req.user.id },
  });
  if (!notification) throw new ApiError(404, 'Notification not found.');
  const updated = notification.readAt
    ? notification
    : await prisma.notification.update({
        where: { id: notification.id },
        data: { readAt: new Date() },
      });
  return sendResponse(res, true, updated, 'Notification marked as read.');
});

export const getDashboard = asyncHandler(async (req, res) => {
  const scope = req.user.role === 'manager'
    ? { officeId: req.user.officeId }
    : accountScope(req.user);
  await markOverduePromises(scope);

  const [accounts, people, pendingPromises, pendingSettlementRequests] = await Promise.all([
    prisma.account.findMany({
      where: scope,
      select: { loanNo: true, outstanding: true, status: true, assignedToId: true },
    }),
    prisma.user.count({
      where: ['head', 'coo'].includes(req.user.role)
        ? { role: 'caller' }
        : req.user.role === 'manager'
          ? { role: 'caller', officeId: req.user.officeId }
          : { id: req.user.id },
    }),
    prisma.pTP.count({ where: { status: 'Pending', account: { is: scope } } }),
    prisma.settlementOffer.count({
      where: {
        status: 'Pending',
        ...(req.user.role === 'manager' ? { stage: 'Manager' } : req.user.role === 'head' ? { stage: 'Head' } : {}),
        account: { is: scope },
      },
    }),
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
  const indiaNow = new Date(now.getTime() + INDIA_OFFSET_MS);
  const currentYear = indiaNow.getUTCFullYear();
  const currentMonth = indiaNow.getUTCMonth() + 1;
  const period = req.query.period === 'year' ? 'year' : 'month';
  const selectedYear = /^\d{4}$/.test(String(req.query.year || ''))
    ? Number(req.query.year)
    : currentYear;
  const requestedMonth = Number(req.query.month);
  const selectedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
    ? requestedMonth
    : currentMonth;
  const periodStart = new Date(Date.UTC(
    selectedYear,
    period === 'month' ? selectedMonth - 1 : 0,
    1,
  ) - INDIA_OFFSET_MS);
  const periodEnd = new Date(Date.UTC(
    selectedYear,
    period === 'month' ? selectedMonth : 12,
    1,
  ) - INDIA_OFFSET_MS);
  const monthStart = indiaPeriodStart(now, true);
  const todayStart = indiaPeriodStart(now);
  const [paymentTotals, monthPayments, selectedPayments, todayPayments, paidByAccount] = accountIds.length
    ? await Promise.all([
        prisma.payment.aggregate({ where: { accountId: { in: accountIds } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { accountId: { in: accountIds }, paidAt: { gte: monthStart } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { accountId: { in: accountIds }, paidAt: { gte: periodStart, lt: periodEnd } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { accountId: { in: accountIds }, paidAt: { gte: todayStart } }, _sum: { amount: true } }),
        prisma.payment.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _sum: { amount: true } }),
      ])
    : [null, null, null, null, []];
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
    selectedCollected: money(selectedPayments?._sum.amount),
    selectedPeriod: { type: period, month: selectedMonth, year: selectedYear },
    todayCollected: money(todayPayments?._sum.amount),
    recoveryPercent: totalOutstanding > 0 ? (totalPaid / totalOutstanding) * 100 : 0,
    remainingBalance,
    assigned,
    unassigned: accounts.length - assigned,
    callers: people,
    pendingPromises,
    pendingSettlementRequests,
    statuses,
    recent,
  }, 'Dashboard loaded.');
});
