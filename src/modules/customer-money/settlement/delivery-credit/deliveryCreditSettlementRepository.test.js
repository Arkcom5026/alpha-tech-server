'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createSettlement,
  getSettlement,
  listSettlements,
} = require('./deliveryCreditSettlementRepository');

const makeSettlement = (overrides = {}) => ({
  id: 41,
  code: 'CMS-0041',
  branchId: 13,
  customerId: 283,
  settlementType: 'DELIVERY_CREDIT',
  totalAmount: 500,
  lines: [],
  ...overrides,
});

const makeBranch = (id = 13) => ({
  id,
  name: 'Test Branch',
  documentHeaderConfig: { default: {} },
});

const assertNoInvalidBranchInclude = (args) => {
  assert.ok(args?.include, 'settlement query must keep related customer/line projection');
  assert.equal(Object.prototype.hasOwnProperty.call(args.include, 'branch'), false, 'CustomerMoneySettlement query must never include nonexistent branch relation');
};

test('list hydrates one tenant branch without a CustomerMoneySettlement branch include', async () => {
  let branchQueries = 0;
  const client = {
    customerMoneySettlement: {
      findMany: async (args) => {
        assertNoInvalidBranchInclude(args);
        assert.equal(args.where.branchId, 13);
        return [makeSettlement({ id: 41 }), makeSettlement({ id: 42 })];
      },
    },
    branch: {
      findFirst: async (args) => {
        branchQueries += 1;
        assert.deepEqual(args.where, { id: 13 });
        return makeBranch();
      },
    },
  };

  const rows = await listSettlements({ client, branchId: 13, take: 200 });
  assert.equal(rows.length, 2);
  assert.equal(branchQueries, 1, 'list must hydrate its tenant branch once');
  assert.equal(rows[0].branch.id, 13);
  assert.equal(rows[1].branch.id, 13);
});

test('get remains branch scoped and attaches the hydrated branch', async () => {
  const client = {
    customerMoneySettlement: {
      findFirst: async (args) => {
        assertNoInvalidBranchInclude(args);
        assert.deepEqual(args.where, { id: 41, branchId: 13, settlementType: 'DELIVERY_CREDIT' });
        return makeSettlement();
      },
    },
    branch: {
      findFirst: async (args) => {
        assert.deepEqual(args.where, { id: 13 });
        return makeBranch();
      },
    },
  };

  const row = await getSettlement({ client, id: 41, branchId: 13 });
  assert.equal(row.branch.id, 13);
});

test('create uses the persisted scalar branchId to hydrate document-header authority', async () => {
  const client = {
    customerMoneySettlement: {
      create: async (args) => {
        assertNoInvalidBranchInclude(args);
        return makeSettlement({ branchId: 13 });
      },
    },
    branch: {
      findFirst: async (args) => {
        assert.deepEqual(args.where, { id: 13 });
        return makeBranch();
      },
    },
  };

  const row = await createSettlement({ client, data: { branchId: 13, customerId: 283 } });
  assert.equal(row.branch.id, 13);
});
