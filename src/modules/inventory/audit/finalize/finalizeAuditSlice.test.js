const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cancelAudit, confirmAudit } = require('./finalizeAuditService');

test('cancel preserves branch, READY, and closed-session policies', async () => {
  const forbidden = await cancelAudit({
    sessionId: 1,
    branchId: 2,
    repositories: { findAuditSession: async () => ({ id: 1, branchId: 1, mode: 'READY', status: 'DRAFT', confirmedAt: null }) },
  });
  assert.equal(forbidden.status, 403);

  const closed = await cancelAudit({
    sessionId: 1,
    branchId: 1,
    repositories: { findAuditSession: async () => ({ id: 1, branchId: 1, mode: 'READY', status: 'DRAFT', confirmedAt: new Date() }) },
  });
  assert.equal(closed.status, 409);
  assert.match(closed.body.message, /α╕¢α╕┤α╕öα╣äα╕¢α╣üα╕Ñα╣ëα╕º/);
});

test('cancel delegates closure and preserves legacy response', async () => {
  let command;
  const result = await cancelAudit({
    sessionId: 4,
    branchId: 3,
    repositories: {
      findAuditSession: async () => ({ id: 4, branchId: 3, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
      cancelAuditSession: async (input) => { command = input; },
    },
  });
  assert.deepEqual(command, { sessionId: 4 });
  assert.deepEqual(result, { status: 200, body: { ok: true, status: 'CANCELLED' } });
});

test('confirm maps strategy to stock status and preserves response', async () => {
  let pendingCommand;
  const pending = await confirmAudit({
    sessionId: 7,
    branchId: 5,
    repositories: {
      findAuditSession: async () => ({ id: 7, branchId: 5, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
      confirmAuditSession: async (input) => { pendingCommand = input; },
    },
  });
  assert.deepEqual(pendingCommand, { sessionId: 7, targetStatus: 'MISSING_PENDING_REVIEW' });
  assert.deepEqual(pending, { status: 200, body: { confirmed: true } });

  let lostCommand;
  await confirmAudit({
    sessionId: 8,
    branchId: 5,
    strategy: 'MARK_LOST',
    repositories: {
      findAuditSession: async () => ({ id: 8, branchId: 5, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
      confirmAuditSession: async (input) => { lostCommand = input; },
    },
  });
  assert.deepEqual(lostCommand, { sessionId: 8, targetStatus: 'LOST' });
});

test('module route owns confirm and cancel without legacy handlers', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/stockAuditRoutes.js'), 'utf8');
  assert.match(source, /finalizeAuditController/);
  assert.match(source, /confirmAuditController/);
  assert.match(source, /cancelAuditController/);
  assert.doesNotMatch(source, /controllers\/stockAuditController/);
});
