
import { parse } from 'csv-parse/sync';

import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { accountScope, dayEnd } from '../utils/accountScope.js';
import { sendResponse } from '../utils/sendResponse.js';
import { statusType } from '../utils/statusType.js';
import { resolvePaymentStatus } from '../utils/accountResolution.js';
import {
  isPastCalendarDateInIndia,
  markOverduePromises,
} from '../utils/promiseStatus.js';


const ACCOUNT_STATUSES = [
  'New',
  'Working',
  'PTP',
  'Part_paid',
  'Closed',
  'Settled',
];
const CALL_DISPOSITIONS = [
  'No answer', 'Busy', 'Connected', 'Wrong number',
  'Call back requested', 'Refused to pay', 'Promise to pay', 'Dispute raised',
];

const ACCOUNT_INCLUDE = {
  office: { select: { name: true } },
  assignedTo: { select: { id: true, name: true } },
  promises: {
    where: { status: 'Pending' },
    orderBy: { dueDate: 'asc' },
    take: 1,
  },
  _count: { select: { payments: true } },
  settlements: {
    include: {
      requestedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
};

const BATCH_SIZE = 1000;

const money = (value) => Number(value || 0);

function getUtcDateBounds(date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}

function getPagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(query.pageSize) || 25)
  );

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  };
}

function buildAccountFilters(req) {
  const where = {
    AND: [accountScope(req.user)],
  };

  const { status, office, ownerId, unassigned, q } = req.query;
  const role = req.user.role;

  if (status && status !== 'All') {
    if (!ACCOUNT_STATUSES.includes(status)) {
      throw new ApiError(
        statusType.BAD_REQUEST,
        'Choose a valid account status.'
      );
    }

    where.status = status;
  }


  if (office && ['head', 'coo', 'manager'].includes(role)) {
    where.office = { name: office };
  }


  if (ownerId && ['head', 'coo', 'manager'].includes(role)) {
    where.assignedToId = ownerId;
  }


  if (
    unassigned === 'true' &&
    ['head', 'coo', 'manager'].includes(role)
  ) {
    where.assignedToId = null;
  }

  const search = String(q || '').trim();

  if (search) {
    where.AND.push({
      OR: [
        {
          customerName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        { mobile: { contains: search } },
        {
          loanNo: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ],
    });
  }

  return where;
}

async function attachPaymentTotals(accounts) {
  if (accounts.length === 0) {
    return [];
  }

  const loanNos = accounts.map((account) => account.loanNo);

  const paymentTotals = await prisma.payment.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: loanNos },
    },
    _sum: { amount: true },
  });

  const paidByAccount = Object.fromEntries(
    paymentTotals.map((item) => [
      item.accountId,
      money(item._sum.amount),
    ])
  );

  return accounts.map((account) => ({
    ...account,
    paid: paidByAccount[account.loanNo] || 0,
  }));
}

async function getQueuePriorityIds(where) {
  const endToday = dayEnd(new Date());

  const [duePromises, followUps] = await Promise.all([
    prisma.pTP.findMany({
      where: {
        status: 'Pending',
        dueDate: { lte: endToday },
        account: { is: where },
      },
      select: {
        accountId: true,
        dueDate: true,
      },
      orderBy: { dueDate: 'asc' },
    }),

    prisma.callLog.findMany({
      where: {
        followUpAt: { lte: endToday },
        account: { is: where },
      },
      select: {
        accountId: true,
        followUpAt: true,
      },
      orderBy: { followUpAt: 'asc' },
    }),
  ]);


  const dueByAccount = new Map();

  for (const item of duePromises) {
    const currentDue = dueByAccount.get(item.accountId);
    const promiseDue = new Date(item.dueDate);

    if (!currentDue || promiseDue < currentDue) {
      dueByAccount.set(item.accountId, promiseDue);
    }
  }

  for (const item of followUps) {
    const followUpAt = new Date(item.followUpAt);
    const currentDue = dueByAccount.get(item.accountId);

    if (!currentDue || followUpAt < currentDue) {
      dueByAccount.set(item.accountId, followUpAt);
    }
  }

  return [...dueByAccount.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([loanNo]) => loanNo);
}

async function getQueueAccounts(where, skip, pageSize) {
  const priorityIds = await getQueuePriorityIds(where);

  const priorityForPage = priorityIds.slice(
    skip,
    skip + pageSize
  );

  const priorityRows = priorityForPage.length
    ? await prisma.account.findMany({
        where: {
          ...where,
          loanNo: { in: priorityForPage },
        },
        include: ACCOUNT_INCLUDE,
      })
    : [];


  priorityRows.sort(
    (a, b) =>
      priorityForPage.indexOf(a.loanNo) -
      priorityForPage.indexOf(b.loanNo)
  );


  const regularSkip = Math.max(0, skip - priorityIds.length);
  const regularTake = pageSize - priorityRows.length;

  const regularRows = regularTake
    ? await prisma.account.findMany({
        where: {
          ...where,
          ...(priorityIds.length
            ? { loanNo: { notIn: priorityIds } }
            : {}),
        },
        orderBy: [
          { createdAt: 'asc' },
          { loanNo: 'asc' },
        ],
        skip: regularSkip,
        take: regularTake,
        include: ACCOUNT_INCLUDE,
      })
    : [];

  return [...priorityRows, ...regularRows];
}

export const listAccounts = asyncHandler(async (req, res) => {
  await markOverduePromises(accountScope(req.user));

  const { page, pageSize, skip } = getPagination(req.query);
  const where = buildAccountFilters(req);

  const total = await prisma.account.count({ where });

  const accounts =
    req.query.queue === 'true'
      ? await getQueueAccounts(where, skip, pageSize)
      : await prisma.account.findMany({
          where,
          orderBy: [
            { createdAt: 'asc' },
            { loanNo: 'asc' },
          ],
          skip,
          take: pageSize,
          include: ACCOUNT_INCLUDE,
        });

  const rows = await attachPaymentTotals(accounts);

  return sendResponse(
    res,
    true,
    { rows, total, page, pageSize },
    'Accounts loaded.'
  );
});

export const getAccountDetails = asyncHandler(async (req, res) => {

  const account = req.account;

  const paid = account.payments.reduce(
    (total, payment) => total + money(payment.amount),
    0
  );

  return sendResponse(
    res,
    true,
    { ...account, paid },
    'Account loaded.'
  );
});

export const logCall = asyncHandler(async (req, res) => {
  const { disposition, remarks, followUpAt } = req.body || {};
  const followUpDate = followUpAt ? new Date(followUpAt) : null;

  if (!CALL_DISPOSITIONS.includes(disposition)) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Choose a call outcome.'
    );
  }
  if (followUpAt && (Number.isNaN(followUpDate.getTime()) || isPastCalendarDateInIndia(followUpDate))) {
    throw new ApiError(statusType.BAD_REQUEST, 'Choose a follow-up date that is today or later.');
  }

  const account = req.account;

  const call = await prisma.callLog.create({
    data: {
      accountId: account.loanNo,
      userId: req.user.id,
      disposition,
      remarks: remarks || null,
      followUpAt: followUpDate,
    },
  });


  if (account.status === 'New') {
    await prisma.account.update({
      where: { loanNo: account.loanNo },
      data: { status: 'Working' },
    });
  }

  return sendResponse(
    res,
    true,
    call,
    'Call note saved.',
    statusType.CREATED
  );
});

export const createPromise = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  const dueDate = new Date(req.body?.dueDate);

  if (
    !Number.isFinite(amount) ||
    !(amount > 0) ||
    Number.isNaN(dueDate.getTime()) ||
    isPastCalendarDateInIndia(dueDate)
  ) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Enter a valid promise amount and a due date that is today or later.'
    );
  }

  const account = req.account;
  if (['Closed', 'Settled'].includes(account.status)) {
    throw new ApiError(
      statusType.CONFLICT,
      'This account is already resolved and cannot receive a new promise.'
    );
  }

  const promise = await prisma.pTP.create({
    data: {
      accountId: account.loanNo,
      userId: req.user.id,
      amount,
      dueDate,
    },
  });

  await prisma.account.update({
    where: { loanNo: account.loanNo },
    data: { status: 'PTP' },
  });

  return sendResponse(
    res,
    true,
    promise,
    'Promise to pay recorded.',
    statusType.CREATED
  );
});

export const createSettlementOffer = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  const account = req.account;
  if (!Number.isFinite(amount) || amount <= 0 || amount > money(account.outstanding)) {
    throw new ApiError(statusType.BAD_REQUEST, 'Enter a settlement amount above zero and no greater than the original outstanding.');
  }
  if (['Closed', 'Settled'].includes(account.status)) {
    throw new ApiError(statusType.CONFLICT, 'This account is already resolved.');
  }
  const activeOffer = await prisma.settlementOffer.findFirst({
    where: { accountId: account.loanNo, status: { in: ['Pending', 'Approved'] } },
    select: { id: true },
  });
  if (activeOffer) {
    throw new ApiError(statusType.CONFLICT, 'Resolve the existing settlement request before creating another.');
  }
  const offer = await prisma.settlementOffer.create({
    data: { accountId: account.loanNo, amount, requestedById: req.user.id },
    include: { requestedBy: { select: { id: true, name: true } } },
  });
  return sendResponse(res, true, offer, 'Settlement request submitted for approval.', statusType.CREATED);
});

export const reviewSettlementOffer = asyncHandler(async (req, res) => {
  const { decision } = req.body || {};
  const account = req.account;
  if (['Closed', 'Settled'].includes(account.status)) {
    throw new ApiError(statusType.CONFLICT, 'This account is already resolved.');
  }
  if (!['approve', 'reject'].includes(decision)) {
    throw new ApiError(statusType.BAD_REQUEST, 'Choose approve or reject.');
  }
  const offer = await prisma.settlementOffer.findFirst({
    where: { id: req.params.settlementId, accountId: account.loanNo },
  });
  if (!offer) throw new ApiError(statusType.NOT_FOUND, 'Settlement request not found.');
  if (offer.status !== 'Pending') throw new ApiError(statusType.CONFLICT, 'This settlement request has already been reviewed.');
  if (offer.requestedById === req.user.id) {
    throw new ApiError(statusType.FORBIDDEN, 'A settlement request must be reviewed by another authorized user.');
  }

  const reviewed = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.settlementOffer.updateMany({
      where: { id: offer.id, status: 'Pending' },
      data: {
        status: decision === 'approve' ? 'Approved' : 'Rejected',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });
    if (updateResult.count !== 1) {
      throw new ApiError(statusType.CONFLICT, 'This settlement request has already been reviewed.');
    }
    const updatedOffer = await tx.settlementOffer.findUnique({
      where: { id: offer.id },
      include: {
        requestedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });
    await tx.notification.create({
      data: {
        userId: offer.requestedById,
        accountId: account.loanNo,
        settlementOfferId: offer.id,
        title: decision === 'approve' ? 'Settlement request approved' : 'Settlement request rejected',
        message: `Your ₹${money(offer.amount).toLocaleString('en-IN')} settlement request for account ${account.loanNo} was ${decision === 'approve' ? 'approved' : 'rejected'}.`,
      },
    });
    if (decision === 'approve') {
      const paid = await tx.payment.aggregate({
        where: { accountId: account.loanNo },
        _sum: { amount: true },
      });
      if (money(paid._sum.amount) >= money(offer.amount)) {
        await tx.account.update({ where: { loanNo: account.loanNo }, data: { status: 'Settled' } });
      }
    }
    return updatedOffer;
  });
  const resultMessage = decision === 'approve'
    ? 'Settlement request approved.'
    : 'Settlement request rejected.';
  return sendResponse(res, true, reviewed, resultMessage);
});

export const recordPayment = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);
  const paidAt = req.body?.paidAt
    ? new Date(req.body.paidAt)
    : new Date();

  if (
    !Number.isFinite(amount) ||
    !(amount > 0) ||
    Number.isNaN(paidAt.getTime()) ||
    paidAt > new Date()
  ) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Enter a valid payment amount and date.'
    );
  }

  const account = req.account;
  if (['Closed', 'Settled'].includes(account.status)) {
    throw new ApiError(
      statusType.CONFLICT,
      'This account is already resolved. Reopen it before recording another payment.'
    );
  }
  const paidDateBounds = getUtcDateBounds(paidAt);
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        accountId: account.loanNo,
        userId: req.user.id,
        amount,
        reference: req.body.reference || null,
        notes: req.body.notes || null,
        paidAt,
      },
    });

    const paymentTotal = await tx.payment.aggregate({
      where: { accountId: account.loanNo },
      _sum: { amount: true },
    });
    const totalPaid = money(paymentTotal._sum.amount);

    if (totalPaid > money(account.outstanding) + 0.005) {
      throw new ApiError(
        statusType.BAD_REQUEST,
        'Payment exceeds the remaining outstanding balance.'
      );
    }

    const approvedSettlement = await tx.settlementOffer.findFirst({
      where: { accountId: account.loanNo, status: 'Approved' },
      orderBy: { reviewedAt: 'desc' },
    });
    const status = resolvePaymentStatus({
      totalPaid,
      outstanding: money(account.outstanding),
      approvedSettlementAmount: approvedSettlement ? money(approvedSettlement.amount) : null,
    });

    await tx.account.update({
      where: { loanNo: account.loanNo },
      data: { status },
    });

    const promises = await tx.pTP.findMany({
      where: {
        accountId: account.loanNo,
        status: 'Pending',
        createdAt: { lte: paidDateBounds.end },
        dueDate: { gte: paidDateBounds.start },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        dueDate: true,
      },
    });

    for (const promise of promises) {
      const promiseStart = getUtcDateBounds(promise.createdAt).start;
      const promiseEnd = getUtcDateBounds(promise.dueDate).end;
      const paymentsAfterPromise = await tx.payment.aggregate({
        where: {
          accountId: account.loanNo,
          paidAt: {
            gte: promiseStart,
            lte: promiseEnd,
          },
        },
        _sum: { amount: true },
      });

      if (money(paymentsAfterPromise._sum.amount) >= money(promise.amount)) {
        await tx.pTP.update({
          where: { id: promise.id },
          data: { status: 'Kept' },
        });
      }
    }

    return { payment, totalPaid, status };
  });

  return sendResponse(
    res,
    true,
    { payment: result.payment, paid: result.totalPaid, status: result.status },
    'Payment recorded.',
    statusType.CREATED
  );
});

export const allocateAccounts = asyncHandler(async (req, res) => {
  const { loanNos, userId } = req.body || {};

  if (!Array.isArray(loanNos) || loanNos.length === 0 || !userId) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Select accounts and a caller.'
    );
  }


  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  const isCaller = target?.role === 'caller';
  const isOutsideManagerTeam =
    req.user.role === 'manager' &&
    target?.managerId !== req.user.id;

  if (!target || !isCaller || isOutsideManagerTeam) {
    throw new ApiError(
      statusType.FORBIDDEN,
      'Choose a caller on your team.'
    );
  }


  const uniqueLoanNos = [...new Set(loanNos.map(String))];
  const accounts = await prisma.account.findMany({
    where: {
      loanNo: { in: uniqueLoanNos },
      AND: [accountScope(req.user)],
    },
    select: {
      loanNo: true,
      assignedToId: true,
      officeId: true,
      status: true,
    },
  });

  if (!accounts.length || accounts.length !== uniqueLoanNos.length) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'No accessible accounts were selected.'
    );
  }

  if (accounts.some((account) => ['Closed', 'Settled'].includes(account.status))) {
    throw new ApiError(
      statusType.CONFLICT,
      'Resolved accounts cannot be assigned to a caller.'
    );
  }


  await prisma.$transaction(async (tx) => {
    await Promise.all(
      accounts.map((account) =>
        tx.account.update({
          where: { loanNo: account.loanNo },
          data: {
            assignedToId: target.id,
            status:
              account.status === 'New'
                ? 'Working'
                : account.status,
          },
        })
      )
    );

    await tx.allocation.createMany({
      data: accounts.map((account) => ({
        accountId: account.loanNo,
        userId: target.id,
        allocatedBy: req.user.id,
        fromUserId: account.assignedToId,
      })),
    });
  });

  return sendResponse(
    res,
    true,
    {
      allocated: accounts.length,
      caller: target.name,
    },
    'Accounts assigned.'
  );
});

function parseUploadedCsv(buffer) {
  try {
    return parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  } catch {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'The uploaded file is not a valid CSV.'
    );
  }
}

function mapImportedAccount(row, officeMap) {
  const officeId = officeMap.get(
    String(row.office || '').toLowerCase()
  );

  if (!officeId) {
    return null;
  }

  return {
    loanNo: row.loan_no,
    portfolio: row.portfolio || 'Unassigned',
    sellerBank: row.seller_bank || 'Unknown',
    customerName: row.customer_name,
    mobile: row.mobile,
    email: row.email || null,
    city: row.city || '',
    state: row.state || '',
    officeId,
    language: row.language || 'English',
    product: row.product || 'Personal Loan',
    originalAmount: Number(row.original_amount || 0),
    outstanding: Number(row.outstanding),
    npaDate: row.npa_date
      ? new Date(row.npa_date)
      : null,
    lastPaymentDate: row.last_payment_date
      ? new Date(row.last_payment_date)
      : null,
  };
}

async function getImportableAccountRecords(rows, user) {
  const offices = await prisma.office.findMany();


  const officeMap = new Map(
    offices.map((office) => [
      office.name.toLowerCase(),
      office.id,
    ])
  );

  const records = [];

  for (const row of rows) {
    const outstanding = Number(row.outstanding);
    const originalAmount = row.original_amount ? Number(row.original_amount) : 0;
    const validDate = (value) => !value || !Number.isNaN(new Date(value).getTime());
    if (
      !row.loan_no ||
      !row.customer_name ||
      !row.mobile ||
      !Number.isFinite(outstanding) ||
      outstanding <= 0 ||
      !Number.isFinite(originalAmount) ||
      originalAmount < 0 ||
      !validDate(row.npa_date) ||
      !validDate(row.last_payment_date)
    ) {
      continue;
    }

    const record = mapImportedAccount(row, officeMap);


    if (
      !record ||
      (user.role === 'manager' &&
        record.officeId !== user.officeId)
    ) {
      continue;
    }

    records.push(record);
  }

  return records;
}

async function insertAccountsInBatches(records) {
  let imported = 0;

  for (let index = 0; index < records.length; index += BATCH_SIZE) {
    const batch = records.slice(index, index + BATCH_SIZE);

    const result = await prisma.account.createMany({
      data: batch,
      skipDuplicates: true,
    });

    imported += result.count;
  }

  return imported;
}

export const importAccounts = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Choose a CSV file to upload.'
    );
  }

  const rows = parseUploadedCsv(req.file.buffer);

  if (rows.length > 100000) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Upload is limited to 100,000 rows at a time.'
    );
  }

  const records = await getImportableAccountRecords(
    rows,
    req.user
  );

  const imported = await insertAccountsInBatches(records);

  return sendResponse(
    res,
    true,
    {
      imported,
      skipped: rows.length - imported,
      received: rows.length,
    },
    'CSV import complete.'
  );
});
