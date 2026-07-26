const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertStockItemBranch,
  assertNoActiveRepair,
  assertNoActiveClaim,
  assertCustomerMatchesLatestSale,
  inferSourceSupplierId,
} = require('./repairIntakePolicy');

test('validates stock existence and branch ownership', () => {
  assert.throws(() => assertStockItemBranch(null, 1), {
    code: 'REPAIR_STOCK_ITEM_NOT_FOUND',
    status: 'fail',
  });
  assert.throws(() => assertStockItemBranch({ branchId: 2 }, 1), {
    code: 'REPAIR_STOCK_ITEM_BRANCH_MISMATCH',
    status: 'fail',
  });
  assert.doesNotThrow(() => assertStockItemBranch({ branchId: '1' }, 1));
});

test('blocks active repair but ignores terminal repair history', () => {
  assert.throws(
    () => assertNoActiveRepair({ repairJobs: [{ id: 4, jobNo: 'RP-4', status: 'WAITING_PARTS' }] }),
    (error) => {
      assert.equal(error.code, 'REPAIR_ACTIVE_REPAIR_EXISTS');
      assert.equal(error.details.repairJobId, 4);
      return true;
    }
  );
  assert.doesNotThrow(() => assertNoActiveRepair({ repairJobs: [{ status: 'COMPLETED' }] }));
  assert.doesNotThrow(() => assertNoActiveRepair({}));
});

test('blocks active claim but ignores terminal claim history', () => {
  assert.throws(
    () => assertNoActiveClaim({ warrantyClaims: [{ id: 8, claimNo: 'CL-8', status: 'APPROVED' }] }),
    (error) => {
      assert.equal(error.code, 'WARRANTY_ACTIVE_CLAIM_EXISTS');
      assert.equal(error.details.warrantyClaimId, 8);
      return true;
    }
  );
  assert.doesNotThrow(() => assertNoActiveClaim({ warrantyClaims: [{ status: 'RESOLVED' }] }));
});

test('compares the customer against the latest sale and supports manager override', () => {
  const stockItem = {
    saleItems: [
      { sale: { customerId: 10, soldAt: '2026-01-01T00:00:00.000Z' } },
      { sale: { customerId: 20, soldAt: '2026-07-01T00:00:00.000Z' } },
      { sale: null },
    ],
  };

  assert.doesNotThrow(() => assertCustomerMatchesLatestSale(stockItem, '20', false));
  assert.throws(
    () => assertCustomerMatchesLatestSale(stockItem, 10, false),
    (error) => {
      assert.equal(error.code, 'REPAIR_STOCK_ITEM_CUSTOMER_MISMATCH');
      assert.deepEqual(error.details, { expectedCustomerId: 20, providedCustomerId: 10 });
      return true;
    }
  );
  assert.doesNotThrow(() => assertCustomerMatchesLatestSale(stockItem, 10, true));
});

test('infers source supplier from purchase receipt history', () => {
  assert.equal(inferSourceSupplierId({ purchaseOrderReceiptItem: { receipt: { supplierId: 77 } } }), 77);
  assert.equal(inferSourceSupplierId({}), null);
  assert.equal(inferSourceSupplierId(null), null);
});