import test from 'node:test';
import assert from 'node:assert/strict';

import { resolvePaymentStatus } from '../src/utils/accountResolution.js';

test('partial payments remain Part_paid without an approved settlement', () => {
  assert.equal(
    resolvePaymentStatus({ totalPaid: 250, outstanding: 1000 }),
    'Part_paid',
  );
});

test('full repayment settles the account when there is no approved offer', () => {
  assert.equal(
    resolvePaymentStatus({ totalPaid: 1000, outstanding: 1000 }),
    'Settled',
  );
});

test('an approved reduced settlement resolves the account at its approved amount', () => {
  assert.equal(
    resolvePaymentStatus({
      totalPaid: 200,
      outstanding: 1000,
      approvedOffer: { amount: 200, type: 'Settlement' },
    }),
    'Settled',
  );
});

test('an approved settlement does not resolve the account before it is paid', () => {
  assert.equal(
    resolvePaymentStatus({
      totalPaid: 150,
      outstanding: 1000,
      approvedOffer: { amount: 200, type: 'Settlement' },
    }),
    'Part_paid',
  );
});

test('a zero payment does not change the existing account status to Part_paid', () => {
  assert.equal(
    resolvePaymentStatus({ totalPaid: 0, outstanding: 1000, currentStatus: 'Working' }),
    'Working',
  );
});

test('a fully paid approved closure is Settled', () => {
  assert.equal(
    resolvePaymentStatus({
      totalPaid: 1000,
      outstanding: 1000,
      approvedOffer: { amount: 1000, type: 'Closure' },
    }),
    'Settled',
  );
});
