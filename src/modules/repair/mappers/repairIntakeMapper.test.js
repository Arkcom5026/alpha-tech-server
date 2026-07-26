const test = require('node:test');
const assert = require('node:assert/strict');
const { mapIntakeContext } = require('./repairIntakeMapper');

function createStockItem(overrides = {}) {
  return {
    id: 101,
    barcode: 'AT-000101',
    serialNumber: 'SN-000101',
    status: 'SOLD',
    warrantyDays: 365,
    soldAt: '2026-01-01T00:00:00.000Z',
    expiredAt: '2099-01-01T00:00:00.000Z',
    branchId: 1,
    product: {
      id: 10,
      name: 'Notebook Test',
      warrantyDays: 365,
      brand: { name: 'Alpha' },
      productType: { name: 'Notebook' },
    },
    saleItems: [],
    repairJobs: [],
    warrantyClaims: [],
    purchaseOrderReceiptItem: null,
    ...overrides,
  };
}

test('maps stock identity and recommends creating a repair job when no active process exists', () => {
  const result = mapIntakeContext(createStockItem());

  assert.deepEqual(result.identity, {
    id: 101,
    barcode: 'AT-000101',
    serialNumber: 'SN-000101',
    status: 'SOLD',
    warrantyDays: 365,
    soldAt: '2026-01-01T00:00:00.000Z',
    expiredAt: '2099-01-01T00:00:00.000Z',
    branchId: 1,
    product: {
      id: 10,
      name: 'Notebook Test',
      brand: 'Alpha',
      productType: 'Notebook',
    },
  });
  assert.equal(result.activeProcesses.repair, null);
  assert.equal(result.activeProcesses.claim, null);
  assert.equal(result.recommendedActions[0].type, 'CREATE_REPAIR_JOB');
});

test('prioritizes an active claim over an active repair', () => {
  const result = mapIntakeContext(createStockItem({
    repairJobs: [
      {
        id: 201,
        jobNo: 'REP-201',
        status: 'IN_PROGRESS',
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ],
    warrantyClaims: [
      {
        id: 301,
        claimNo: 'CLM-301',
        status: 'SUBMITTED',
        repairJobId: 201,
        repairLinkState: 'LINKED',
        openedAt: '2026-04-02T00:00:00.000Z',
      },
    ],
  }));

  assert.deepEqual(result.activeProcesses.repair, {
    id: 201,
    jobNo: 'REP-201',
    status: 'IN_PROGRESS',
  });
  assert.deepEqual(result.activeProcesses.claim, {
    id: 301,
    claimNo: 'CLM-301',
    status: 'SUBMITTED',
  });
  assert.equal(result.recommendedActions[0].type, 'OPEN_ACTIVE_CLAIM');
  assert.equal(result.recommendedActions[0].referenceId, 301);
  assert.equal(
    result.recommendedActions.some((action) => action.type === 'ASSESS_WARRANTY_CLAIM'),
    false
  );
});

test('selects the newest sale, repair, and claim records for intake history', () => {
  const result = mapIntakeContext(createStockItem({
    saleItems: [
      {
        price: '15000.50',
        sale: {
          id: 1,
          code: 'SALE-OLD',
          soldAt: '2026-01-01T00:00:00.000Z',
          customerId: 11,
          customer: { name: 'Old Customer' },
        },
      },
      {
        price: '17500',
        sale: {
          id: 2,
          code: 'SALE-NEW',
          soldAt: '2026-03-01T00:00:00.000Z',
          customerId: 12,
          customer: { companyName: 'New Company' },
        },
      },
    ],
    repairJobs: [
      { id: 20, jobNo: 'REP-OLD', status: 'COMPLETED', createdAt: '2026-02-01T00:00:00.000Z' },
      { id: 21, jobNo: 'REP-NEW', status: 'COMPLETED', createdAt: '2026-04-01T00:00:00.000Z' },
    ],
    warrantyClaims: [
      {
        id: 30,
        claimNo: 'CLM-OLD',
        status: 'RESOLVED',
        repairJobId: 20,
        repairLinkState: 'LINKED',
        openedAt: '2026-02-02T00:00:00.000Z',
      },
      {
        id: 31,
        claimNo: 'CLM-NEW',
        status: 'RESOLVED',
        repairJobId: 21,
        repairLinkState: 'LINKED',
        openedAt: '2026-04-02T00:00:00.000Z',
      },
    ],
  }));

  assert.equal(result.latestSale.code, 'SALE-NEW');
  assert.equal(result.latestSale.customerName, 'New Company');
  assert.equal(result.latestSale.price, 17500);
  assert.equal(result.latestRepair.jobNo, 'REP-NEW');
  assert.equal(result.latestClaim.claimNo, 'CLM-NEW');
});

test('recommends warranty assessment only when supplier source exists and warranty is active', () => {
  const activeWarranty = mapIntakeContext(createStockItem({
    purchaseOrderReceiptItem: {
      receipt: {
        id: 401,
        code: 'RCV-401',
        receivedAt: '2025-12-20T00:00:00.000Z',
        supplierId: 501,
        supplier: {
          id: 501,
          name: 'Supplier Test',
          phone: '020000000',
          email: 'supplier@example.com',
        },
      },
    },
  }));

  assert.equal(activeWarranty.procurement.receiptCode, 'RCV-401');
  assert.equal(activeWarranty.procurement.supplier.name, 'Supplier Test');
  assert.equal(
    activeWarranty.recommendedActions.some((action) => action.type === 'ASSESS_WARRANTY_CLAIM'),
    true
  );

  const expiredWarranty = mapIntakeContext(createStockItem({
    expiredAt: '2000-01-01T00:00:00.000Z',
    purchaseOrderReceiptItem: {
      receipt: {
        id: 402,
        code: 'RCV-402',
        receivedAt: '1999-12-20T00:00:00.000Z',
        supplierId: 502,
        supplier: { id: 502, name: 'Old Supplier', phone: null, email: null },
      },
    },
  }));

  assert.equal(expiredWarranty.warranty.isExpired, true);
  assert.equal(
    expiredWarranty.recommendedActions.some((action) => action.type === 'ASSESS_WARRANTY_CLAIM'),
    false
  );
});

test('computes warranty expiry from sold date when no explicit expiry exists', () => {
  const result = mapIntakeContext(createStockItem({
    soldAt: '2026-01-01T00:00:00.000Z',
    expiredAt: null,
    warrantyDays: 30,
  }));

  assert.equal(result.warranty.warrantyDays, 30);
  assert.equal(result.warranty.startsAt.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(result.warranty.expiresAt.toISOString(), '2026-01-31T00:00:00.000Z');
});
