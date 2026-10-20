import test from 'node:test';
import assert from 'node:assert/strict';

import { accountScope, canSeeAccount } from '../src/utils/accountScope.js';

test('manager allocation scope includes unassigned accounts across offices', () => {
  const manager = { id: 'manager-1', role: 'manager', officeId: 'office-a' };
  assert.deepEqual(accountScope(manager), {
    OR: [{ assignedToId: null }, { assignedTo: { managerId: manager.id } }],
  });
  assert.equal(canSeeAccount(manager, { officeId: 'office-b', assignedTo: null }), true);
});

test('manager can see their own caller assignments across offices but not another manager team', () => {
  const manager = { id: 'manager-1', role: 'manager', officeId: 'office-a' };
  assert.equal(
    canSeeAccount(manager, { officeId: 'office-b', assignedTo: { managerId: 'manager-1' } }),
    true,
  );
  assert.equal(
    canSeeAccount(manager, { officeId: 'office-b', assignedTo: { managerId: 'manager-2' } }),
    false,
  );
});

test('callers can only see accounts assigned to them', () => {
  const caller = { id: 'caller-1', role: 'caller' };
  assert.equal(canSeeAccount(caller, { assignedToId: caller.id }), true);
  assert.equal(canSeeAccount(caller, { assignedToId: 'caller-2' }), false);
});
