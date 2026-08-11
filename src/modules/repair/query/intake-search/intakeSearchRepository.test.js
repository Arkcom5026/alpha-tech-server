const test = require('node:test');
const assert = require('node:assert/strict');
const { IntakeSearchRepository } = require('./intakeSearchRepository');

test('customer-name intake search includes devices from sale ownership and prior repair history', async () => {
  const calls = {};
  const repository = new IntakeSearchRepository({
    stockItem: {
      async findMany(input) {
        calls.stockItem = input;
        return [];
      },
    },
    device: {
      async findMany(input) {
        calls.device = input;
        return [];
      },
    },
    customerProfile: {
      async findMany(input) {
        calls.customer = input;
        return [];
      },
    },
  });

  await repository.search(2, 'ชัยวัฒน์', 10);

  assert.equal(calls.stockItem.where.branchId, 2);
  assert.equal(calls.device.where.branchId, 2);
  assert.equal(calls.device.where.stockItemId, null);

  const stockWhere = JSON.stringify(calls.stockItem.where);
  const deviceWhere = JSON.stringify(calls.device.where);

  assert.match(stockWhere, /saleItems/);
  assert.match(stockWhere, /repairJobs/);
  assert.match(stockWhere, /customer/);
  assert.match(deviceWhere, /currentOwner/);
  assert.match(deviceWhere, /repairJobs/);
  assert.match(deviceWhere, /customer/);
  assert.match(deviceWhere, /ชัยวัฒน์/);

  assert.equal(calls.stockItem.select._count.select.repairJobs, true);
  assert.equal(calls.device.select._count.select.repairJobs, true);
  assert.equal(calls.stockItem.select.repairJobs.take, 1);
  assert.equal(calls.device.select.repairJobs.take, 1);
});
