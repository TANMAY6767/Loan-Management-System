export function accountScope(user) {
  if (['head', 'coo'].includes(user.role)) return {};
  if (user.role === 'caller') return { assignedToId: user.id };
  if (user.role === 'manager') {
    return {
      officeId: user.officeId,
      OR: [{ assignedToId: null }, { assignedTo: { managerId: user.id } }],
    };
  }
  return { officeId: user.officeId };
}

export function canSeeAccount(user, account) {
  if (['head', 'coo'].includes(user.role)) return true;
  if (user.role === 'caller') return account.assignedToId === user.id;
  if (user.role === 'manager') {
    return account.officeId === user.officeId
      && (!account.assignedTo || account.assignedTo.managerId === user.id);
  }
  return account.officeId === user.officeId;
}

export function dayEnd(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}
