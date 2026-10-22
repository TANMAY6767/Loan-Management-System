export function resolvePaymentStatus({ totalPaid, outstanding, approvedOffer, currentStatus = 'New' }) {
  const paid = Number(totalPaid) || 0;
  const balance = Number(outstanding) || 0;
  if (paid <= 0) return currentStatus;
  if (balance > 0 && paid >= balance) return 'Settled';
  if (approvedOffer && paid >= Number(approvedOffer.amount)) {
    return approvedOffer.type === 'Settlement' ? 'Settled' : 'Closed';
  }
  return 'Part_paid';
}
