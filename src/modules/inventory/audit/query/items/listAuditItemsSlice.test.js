const test = require('node:test');
const assert = require('node:assert/strict');

const { listAuditItems, normalizePositiveInt } = require('./listAuditItemsService');

test('list items rejects invalid session identity before repository access', async () => {
  let called = false;
  const result = await listAuditItems({
    branchId: 1,
    sessionId: Number.NaN,
    findSession: async () => { called = true; },
  });

  assert.equal(result.status, 400);
  assert.equal(called, false);
});

test('list items preserves branch and READY mode authority', async () => {
  const forbidden = await listAuditItems({
    branchId: 2,
    sessionId: 10,
    findSession: async () => ({ id: 10, branchId: 3, mode: 'READY' }),
  });
  assert.equal(forbidden.status, 403);

  const wrongMode = await listAuditItems({
    branchId: 3,
    sessionId: 10,
    findSession: async () => ({ id: 10, branchId: 3, mode: 'FULL' }),
  });
  assert.equal(wrongMode.status, 400);
});

test('list items normalizes paging and maps legacy response projection', async () => {
  let received;
  const result = await listAuditItems({
    branchId: 3,
    sessionId: 10,
    scanned: '1',
    q: '  abc  ',
    page: '0',
    pageSize: '999',
    findSession: async () => ({ id: 10, branchId: 3, mode: 'READY' }),
    listItems: async (input) => {
      received = input;
      return {
        total: 1,
        items: [{
          id: 8,
          barcode: 'ABC',
          isScanned: true,
          scannedAt: null,
          product: { id: 6, name: 'สินค้า' },
          stockItem: { serialNumber: 'SN-1' },
        }],
      };
    },
  });

  assert.deepEqual(received, {
    sessionId: 10,
    scanned: '1',
    q: 'abc',
    page: 1,
    pageSize: 200,
  });
  assert.deepEqual(result.body, {
    items: [{
      id: 8,
      barcode: 'ABC',
      serialNumber: 'SN-1',
      isScanned: true,
      scannedAt: null,
      product: { id: 6, name: 'สินค้า' },
    }],
    total: 1,
    page: 1,
    pageSize: 200,
  });
});

test('positive integer normalization preserves legacy defaults and cap', () => {
  assert.equal(normalizePositiveInt(undefined, 50, 200), 50);
  assert.equal(normalizePositiveInt('0', 1), 1);
  assert.equal(normalizePositiveInt('250', 50, 200), 200);
});
