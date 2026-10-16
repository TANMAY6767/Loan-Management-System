import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const getTeam = asyncHandler(async (req, res) => {
  const where = ['head', 'coo'].includes(req.user.role)
    ? {}
    : req.user.role === 'manager'
      ? { managerId: req.user.id }
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