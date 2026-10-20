export function resolvePaymentStatus({ totalPaid, outstanding, approvedSettlementAmount }) {
  if (
    approvedSettlementAmount != null &&
    totalPaid >= approvedSettlementAmount
  ) {
    return 'Settled';
  }

  return totalPaid >= outstanding ? 'Closed' : 'Part_paid';
}
