const test = require('node:test');
const assert = require('node:assert/strict');
const { GetWarrantyReplacementOptionsService } = require('./getWarrantyReplacementOptionsService');
const { RepairFailureCode } = require('../../contracts/repairError');

test('returns only branch-scoped in-stock replacement options and prefers same product', async () => {
  const service = new GetWarrantyReplacementOptionsService({
    findClaim(branchId, claimId) {
      assert.equal(branchId, 4);
      assert.equal(claimId, 31);
      return { id: 31, branchId: 4, status: 'REPLACEMENT_PENDING', stockItemId: 12, stockItem: { productId: 8 } };
    },
    searchAvailableStock(branchId, query) {
      assert.equal(branchId, 4);
      assert.equal(query, 'note');
      return [
        { id: 90, barcode: 'B90', serialNumber: 'S90', status: 'IN_STOCK', productId: 9, product: { name: 'Other', brand: { name: 'X' } } },
        { id: 12, barcode: 'OLD', serialNumber: 'OLD', status: 'IN_STOCK', productId: 8, product: { name: 'Original', brand: { name: 'Y' } } },
        { id: 91, barcode: 'B91', serialNumber: 'S91', status: 'IN_STOCK', productId: 8, product: { name: 'Notebook', brand: { name: 'Y' } } },
      ];
    },
  });

  const result = await service.execute({ branchId: 4 }, 31, 'note');
  assert.deepEqual(result.options.map((item) => item.id), [91, 90]);
  assert.equal(result.options[0].preferredMatch, true);
  assert.equal(result.options.some((item) => item.id === 12), false);
});

test('blocks replacement search outside replacement-capable claim state', async () => {
  let searches = 0;
  const service = new GetWarrantyReplacementOptionsService({
    findClaim() { return { id: 31, status: 'DRAFT', stockItemId: 12, stockItem: { productId: 8 } }; },
    searchAvailableStock() { searches += 1; return []; },
  });
  await assert.rejects(
    () => service.execute({ branchId: 4 }, 31, ''),
    (error) => error.code === RepairFailureCode.INVALID_CLAIM_TRANSITION
  );
  assert.equal(searches, 0);
});
