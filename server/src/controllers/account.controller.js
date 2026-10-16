
import { parse } from 'csv-parse/sync';

import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { accountScope, dayEnd } from '../utils/accountScope.js';
import { sendResponse } from '../utils/sendResponse.js';
import { statusType } from '../utils/statusType.js';


const ACCOUNT_STATUSES = [
  'New',
  'Working',
  'PTP',
  'Part_paid',
  'Closed',
  'Settled',
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
};

const BATCH_SIZE = 1000;

const money = (value) => Number(value || 0);

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


  if (office && ['head', 'coo'].includes(role)) {
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
    .sort((a, b) => a[1] - b[1])
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
          { status: 'asc' },
          { customerName: 'asc' },
        ],
        skip: regularSkip,
        take: regularTake,
        include: ACCOUNT_INCLUDE,
      })
    : [];

  return [...priorityRows, ...regularRows];
}

export const listAccounts = asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = getPagination(req.query);
  const where = buildAccountFilters(req);

  const total = await prisma.account.count({ where });

  const accounts =
    req.query.queue === 'true'
      ? await getQueueAccounts(where, skip, pageSize)
      : await prisma.account.findMany({
          where,
          orderBy: [
            { status: 'asc' },
            { customerName: 'asc' },
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

  if (!disposition) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Choose a call outcome.'
    );
  }

  const account = req.account;

  const call = await prisma.callLog.create({
    data: {
      accountId: account.loanNo,
      userId: req.user.id,
      disposition,
      remarks: remarks || null,
      followUpAt: followUpAt ? new Date(followUpAt) : null,
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

  if (!(amount > 0) || Number.isNaN(dueDate.getTime())) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Enter a valid promise amount and due date.'
    );
  }

  const account = req.account;

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

export const recordPayment = asyncHandler(async (req, res) => {
  const amount = Number(req.body?.amount);

  if (!(amount > 0)) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'Enter a payment amount greater than zero.'
    );
  }

  const account = req.account;

  const payment = await prisma.payment.create({
    data: {
      accountId: account.loanNo,
      userId: req.user.id,
      amount,
      reference: req.body.reference || null,
      notes: req.body.notes || null,
      paidAt: req.body.paidAt
        ? new Date(req.body.paidAt)
        : new Date(),
    },
  });


  const paymentTotal = await prisma.payment.aggregate({
    where: { accountId: account.loanNo },
    _sum: { amount: true },
  });

  const totalPaid = money(paymentTotal._sum.amount);


  const status =
    totalPaid >= money(account.outstanding)
      ? req.body.settled
        ? 'Settled'
        : 'Closed'
      : 'Part_paid';

  await prisma.account.update({
    where: { loanNo: account.loanNo },
    data: { status },
  });


  await prisma.pTP.updateMany({
    where: {
      accountId: account.loanNo,
      status: 'Pending',
      dueDate: { gte: new Date() },
    },
    data: { status: 'Kept' },
  });

  return sendResponse(
    res,
    true,
    { payment, paid: totalPaid, status },
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


  const accounts = await prisma.account.findMany({
    where: {
      loanNo: { in: loanNos },
      AND: [accountScope(req.user)],
    },
    select: {
      loanNo: true,
      assignedToId: true,
      officeId: true,
      status: true,
    },
  });

  if (!accounts.length) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'No accessible accounts were selected.'
    );
  }


  const hasOfficeMismatch = accounts.some(
    (account) => account.officeId !== target.officeId
  );

  if (hasOfficeMismatch) {
    throw new ApiError(
      statusType.BAD_REQUEST,
      'A caller can only receive accounts from their own office.'
    );
  }


  await prisma.$transaction(
    accounts.map((account) =>
      prisma.account.update({
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


  await prisma.allocation.createMany({
    data: accounts.map((account) => ({
      accountId: account.loanNo,
      userId: target.id,
      allocatedBy: req.user.id,
      fromUserId: account.assignedToId,
    })),
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

    if (
      !row.loan_no ||
      !row.customer_name ||
      !row.mobile ||
      !row.outstanding
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
