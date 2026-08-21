const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PURCHASE_RECEIPT_CAPABILITY,
  allowPurchaseReceiptCapabilities,
} = require('./purchaseReceiptAuthorization');

const runGuard = (user, ...capabilities) => {
  let nextError;
  let nextCalls = 0;
  const guard = allowPurchaseReceiptCapabilities(...capabilities);
  guard({ user }, {}, (error) => {
    nextCalls += 1;
    nextError = error;
  });
  return { nextCalls, nextError };
};

test('legacy employee roles preserve purchase receipt behavior while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const access = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    }, PURCHASE_RECEIPT_CAPABILITY.ACCESS);
    const finalize = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    }, PURCHASE_RECEIPT_CAPABILITY.ACCESS, PURCHASE_RECEIPT_CAPABILITY.FINALIZE);

    assert.equal(access.nextError, undefined, `${employeeRole} should preserve legacy receipt access`);
    assert.equal(finalize.nextError, undefined, `${employeeRole} should preserve legacy receipt finalization`);
  }
});

test('migrated positions require explicit access and finalization capabilities', () => {
  const accessOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: [PURCHASE_RECEIPT_CAPABILITY.ACCESS],
  };

  assert.equal(
    runGuard(accessOnly, PURCHASE_RECEIPT_CAPABILITY.ACCESS).nextError,
    undefined,
  );

  const deniedFinalize = runGuard(
    accessOnly,
    PURCHASE_RECEIPT_CAPABILITY.ACCESS,
    PURCHASE_RECEIPT_CAPABILITY.FINALIZE,
  );
  assert.equal(deniedFinalize.nextError?.code, 'PURCHASE_RECEIPT_FORBIDDEN');
  assert.equal(deniedFinalize.nextError?.statusCode, 403);

  const finalizeOnly = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [PURCHASE_RECEIPT_CAPABILITY.FINALIZE],
  }, PURCHASE_RECEIPT_CAPABILITY.ACCESS, PURCHASE_RECEIPT_CAPABILITY.FINALIZE);
  assert.equal(finalizeOnly.nextError?.code, 'PURCHASE_RECEIPT_FORBIDDEN');

  const full = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: [
      PURCHASE_RECEIPT_CAPABILITY.ACCESS,
      PURCHASE_RECEIPT_CAPABILITY.FINALIZE,
    ],
  }, PURCHASE_RECEIPT_CAPABILITY.ACCESS, PURCHASE_RECEIPT_CAPABILITY.FINALIZE);
  assert.equal(full.nextError, undefined);
});

test('platform admin keeps purchase receipt authority', () => {
  const result = runGuard({
    role: 'ADMIN',
    employeeRole: 'CASHIER',
    positionCapabilities: [],
  }, PURCHASE_RECEIPT_CAPABILITY.ACCESS, PURCHASE_RECEIPT_CAPABILITY.FINALIZE);
  assert.equal(result.nextError, undefined);
});

test('receipt routes separate draft operations from destructive or stock-committing actions', () => {
  const receiptRoutes = fs.readFileSync(
    path.join(__dirname, '../routes/purchaseOrderReceiptRoutes.js'),
    'utf8',
  );
  const itemRoutes = fs.readFileSync(
    path.join(__dirname, '../routes/purchaseOrderReceiptItemRoutes.js'),
    'utf8',
  );

  assert.match(receiptRoutes, /router\.post\('\/', allowReceiptAccess, createPurchaseReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.post\('\/quick-receipts', allowReceiptAccess, createQuickReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.delete\('\/:id', allowReceiptFinalize, deletePurchaseReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.post\('\/:id\/finalize', allowReceiptFinalize, finalizeReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.patch\('\/:id\/finalize', allowReceiptFinalize, finalizeReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.post\('\/:id\/commit', allowReceiptFinalize, commitReceiptController\.handle\)/);
  assert.match(receiptRoutes, /router\.post\('\/:id\/generate-barcodes', allowReceiptAccess, generateReceiptBarcodesController\.handle\)/);
  assert.match(itemRoutes, /router\.post\('\/', allowReceiptAccess, addReceiptItemController\.handle\)/);
  assert.match(itemRoutes, /router\.delete\('\/:id', allowReceiptAccess, deleteReceiptItemController\.handle\)/);
});
