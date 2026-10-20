import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePaymentStatus } from '../src/utils/accountResolution.js';

test('partial payments remain Part_paid without an approved settlement', () => {
  assert.equal(
    resolvePaymentStatus({ totalPaid: 250, outstanding: 1000 }),
    'Part_paid',
  );
});

test('full repayment closes the account when there is no approved settlement', () => {
  assert.equal(
    resolvePaymentStatus({ totalPaid: 1000, outstanding: 1000 }),
    'Closed',
  );
});

test('an approved reduced settlement resolves the account at its approved amount', () => {
  assert.equal(
    resolvePaymentStatus({
      totalPaid: 200,
      outstanding: 1000,
      approvedSettlementAmount: 200,
    }),
    'Settled',
  );
});

test('an approved settlement does not resolve the account before it is paid', () => {
  assert.equal(
    resolvePaymentStatus({
      totalPaid: 150,
      outstanding: 1000,
      approvedSettlementAmount: 200,
    }),
    'Part_paid',
  );
});
