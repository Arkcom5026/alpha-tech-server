const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { startReadyStockAudit } = require('./startAuditService');

test('start audit rejects missing branch authority before repository access', async () => {
  let called = false;
  const result = await startReadyStockAudit({
    branchId: Number.NaN,
    findOpen: async () => { called = true; },
  });

  assert.equal(result.status, 401);
  assert.equal(called, false);
});

test('start audit preserves existing draft conflict payload', async () => {
  const result = await startReadyStockAudit({
    branchId: 7,
    employeeId: 4,
    findOpen: async () => ({ id: 22, expectedCount: 9 }),
  });

  assert.deepEqual(result, {
    status: 409,
    body: {
      message: 'มีรอบตรวจแบบ DRAFT อยู่แล้ว',
      sessionId: 22,
      expectedCount: 9,
    },
  });
});

test('start audit snapshots branch-owned in-stock items and returns legacy shape', async () => {
  let received;
  const expected = [{ id: 1, productId: 10, barcode: 'A001' }];
  const result = await startReadyStockAudit({
    branchId: 7,
    employeeId: 4,
    findOpen: async () => null,
    listExpected: async ({ branchId }) => {
      assert.equal(branchId, 7);
      return expected;
    },
    createAudit: async (input) => {
      received = input;
      return { id: 31 };
    },
  });

  assert.equal(received.branchId, 7);
  assert.equal(received.employeeId, 4);
  assert.equal(received.expected, expected);
  assert.deepEqual(result, { status: 201, body: { sessionId: 31, expectedCount: 1 } });
});

test('stock audit module route owns start and item-list endpoints', () => {
  const routePath = path.resolve(__dirname, '../routes/stockAuditRoutes.js');
  const source = fs.readFileSync(routePath, 'utf8');

  assert.match(source, /start\/startAuditController/);
  assert.match(source, /query\/items\/listAuditItemsController/);
  assert.doesNotMatch(source, /startReadyAudit[\s\S]*controllers\/stockAuditController/);
  assert.doesNotMatch(source, /listAuditItems[\s\S]*controllers\/stockAuditController/);
});
