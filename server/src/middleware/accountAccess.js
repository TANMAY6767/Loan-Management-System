import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { accountScope, canSeeAccount } from '../utils/accountScope.js';
import { statusType } from '../utils/statusType.js';
import { markOverduePromises } from '../utils/promiseStatus.js';

export const loadAccessibleAccount = asyncHandler(async (req, _res, next) => {
  await markOverduePromises(accountScope(req.user));

  const account = await prisma.account.findUnique({
    where: { loanNo: req.params.loanNo },
    include: {
      office: true,
      assignedTo: { select: { id: true, name: true, username: true, managerId: true } },
      calls: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 30 },
      promises: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
      payments: { include: { user: { select: { name: true } } }, orderBy: { paidAt: 'desc' } },
      allocations: {
        include: {
          user: { select: { name: true, username: true } },
          fromUser: { select: { name: true, username: true } },
          allocator: { select: { name: true, username: true } },
        },
        orderBy: { allocatedAt: 'desc' },
      },
    },
  });

  if (!account) throw new ApiError(statusType.NOT_FOUND, 'Account not found.');
  if (!canSeeAccount(req.user, account)) {
    throw new ApiError(statusType.FORBIDDEN, 'You do not have access to this account.');
  }

  req.account = account;
  next();
});
