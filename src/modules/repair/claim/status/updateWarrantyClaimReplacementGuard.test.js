const test = require('node:test');
const assert = require('node:assert/strict');
const { UpdateWarrantyClaimStatusService } = require('./updateWarrantyClaimStatusService');
const { RepairFailureCode } = require('../../contracts/repairError');

function repoFor(replacement) {
  let writes = 0;
  return {
    get writes() { return writes; },
    transaction(work) {
      return work({
        findById() {
          return { id: 31, branchId: 4, status: 'REPLACEMENT_PENDING', stockItemId: 12 };
        },
        findReplacementStockItem() { return replacement; },
        updateWithEvent() { writes += 1; return { id: 31, status: 'RESOLVED', events: [] }; },
      });
    },
  };
}

const payload = {
  status: 'RESOLVED',
  expectedStatus: 'REPLACEMENT_PENDING',
  resolution: 'REPLACED',
  replacementStockItemId: 90,
};

test('rejects replacement stock that is no longer in stock', async () => {
  const repo = repoFor({ id: 90, branchId: 4, status: 'SOLD' });
  const service = new UpdateWarrantyClaimStatusService(repo);
  await assert.rejects(
    () => service.execute({ branchId: 4, employeeId: 8 }, 31, payload),
    (error) => error.code === RepairFailureCode.CONFLICT
  );
  assert.equal(repo.writes, 0);
});

test('rejects choosing the original claimed stock item as its own replacement', async () => {
  const repo = repoFor({ id: 12, branchId: 4, status: 'IN_STOCK' });
  const service = new UpdateWarrantyClaimStatusService(repo);
  await assert.rejects(
    () => service.execute({ branchId: 4, employeeId: 8 }, 31, { ...payload, replacementStockItemId: 12 }),
    (error) => error.code === RepairFailureCode.CONFLICT
  );
  assert.equal(repo.writes, 0);
});
