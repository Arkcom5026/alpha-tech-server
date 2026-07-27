const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { scanBarcode, scanSerial } = require('./scanAuditService');

test('barcode scan preserves branch and closed-session policies', async () => {
  const forbidden = await scanBarcode({
    sessionId: 7,
    branchId: 2,
    barcode: 'ABC',
    repositories: {
      findAuditSession: async () => ({ id: 7, branchId: 1, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
    },
  });
  assert.equal(forbidden.status, 403);

  const closed = await scanBarcode({
    sessionId: 7,
    branchId: 1,
    barcode: 'ABC',
    repositories: {
      findAuditSession: async () => ({ id: 7, branchId: 1, mode: 'READY', status: 'DRAFT', confirmedAt: new Date() }),
    },
  });
  assert.equal(closed.status, 409);
});

test('barcode scan delegates normalized identity and returns legacy response', async () => {
  let command;
  const result = await scanBarcode({
    sessionId: 9,
    branchId: 3,
    barcode: '  BC-1  ',
    userId: 4,
    repositories: {
      findAuditSession: async () => ({ id: 9, branchId: 3, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
      findEmployeeId: async () => 11,
      scanBarcodeTransaction: async (input) => { command = input; return { status: 200 }; },
    },
  });
  assert.deepEqual(command, { sessionId: 9, barcode: 'BC-1', employeeId: 11 });
  assert.deepEqual(result, { status: 200, body: { scanned: true } });
});

test('serial scan preserves legacy aliases and reason mapping', async () => {
  let command;
  const result = await scanSerial({
    sessionId: 5,
    branchId: 8,
    serialNumber: ' SN-9 ',
    employeeId: 2,
    repositories: {
      findAuditSession: async () => ({ id: 5, branchId: 8, mode: 'READY', status: 'DRAFT', confirmedAt: null }),
      findEmployeeId: async ({ employeeId }) => employeeId,
      scanSerialTransaction: async (input) => { command = input; return { status: 422, reason: 'SN_NOT_FOUND' }; },
    },
  });
  assert.deepEqual(command, { sessionId: 5, branchId: 8, serialNumber: 'SN-9', employeeId: 2 });
  assert.equal(result.status, 422);
  assert.match(result.body.message, /Serial Number/);
});

test('module route owns both scan endpoints without legacy scan handlers', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/stockAuditRoutes.js'), 'utf8');
  assert.match(source, /scanAuditController/);
  assert.match(source, /scanBarcodeController/);
  assert.match(source, /scanSerialController/);
  assert.doesNotMatch(source, /\bscanBarcode\b[\s\S]*stockAuditController/);
  assert.doesNotMatch(source, /\bscanSn\b[\s\S]*stockAuditController/);
});
