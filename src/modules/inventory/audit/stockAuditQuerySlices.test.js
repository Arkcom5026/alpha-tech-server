const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getActiveAudit } = require('./query/active/getActiveAuditService');
const { getAuditOverview } = require('./query/overview/getAuditOverviewService');

test('active audit query preserves unauthorized and empty-session contracts', async () => {
  const unauthorized = await getActiveAudit({ branchId: null, repository: async () => null });
  assert.equal(unauthorized.status, 401);

  const result = await getActiveAudit({ branchId: 3, repository: async ({ branchId }) => {
    assert.equal(branchId, 3);
    return null;
  } });
  assert.deepEqual(result, { status: 200, body: { session: null } });
});

test('overview query remains branch-safe and computes missing count', async () => {
  const session = {
    id: 9,
    branchId: 2,
    mode: 'READY',
    expectedCount: 12,
    scannedCount: 7,
  };

  const forbidden = await getAuditOverview({
    sessionId: 9,
    branchId: 1,
    repository: async () => session,
  });
  assert.equal(forbidden.status, 403);

  const result = await getAuditOverview({
    sessionId: 9,
    branchId: 2,
    repository: async ({ sessionId }) => {
      assert.equal(sessionId, 9);
      return session;
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.missingCount, 5);
  assert.equal(result.body.session, session);
});

test('stock audit route authority moves to inventory audit module', () => {
  const rootRoute = fs.readFileSync(path.resolve(__dirname, '../../../../routes/stockAuditRoutes.js'), 'utf8');
  const moduleRoute = fs.readFileSync(path.resolve(__dirname, 'routes/stockAuditRoutes.js'), 'utf8');

  assert.match(rootRoute, /modules\/inventory\/audit\/routes\/stockAuditRoutes/);
  assert.match(moduleRoute, /query\/active\/getActiveAuditController/);
  assert.match(moduleRoute, /query\/overview\/getAuditOverviewController/);
  assert.doesNotMatch(rootRoute, /controllers\/stockAuditController/);
});
