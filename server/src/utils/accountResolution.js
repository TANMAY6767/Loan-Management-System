export function resolvePaymentStatus({ totalPaid, outstanding, approvedOffer }) {
  if (approvedOffer && totalPaid >= Number(approvedOffer.amount)) {
    return approvedOffer.type === 'Settlement' ? 'Settled' : 'Closed';
  }
  if (approvedOffer || totalPaid > 0) return 'Part_paid';
  return totalPaid >= outstanding ? 'Closed' : 'Part_paid';
}
