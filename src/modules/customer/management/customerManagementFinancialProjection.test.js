'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const prismaPath = require.resolve('../../../../lib/prisma');
const repositoryPath = require.resolve('./customerManagementRepository');

const loadRepository = (prisma) => {
  delete require.cache[repositoryPath];
  require.cache[prismaPath] = { exports: { prisma } };
  return require(repositoryPath);
};

test('projects standalone, owner and member finance from canonical batched sources', async () => {
  const calls = [];
  const profiles = [
    { id: 35, branchId: 2, companyName: 'เทศบาล', departmentName: 'สำนักปลัด', financialOwnerCustomerId: null },
    { id: 102, branchId: 2, companyName: 'เทศบาล', departmentName: 'กองช่าง', financialOwnerCustomerId: 35 },
    { id: 7, branchId: 2, companyName: 'เดี่ยว', departmentName: null, financialOwnerCustomerId: null },
  ];
  const record = (name, value) => async (args) => { calls.push([name, args]); return value; };
  const prisma = {
    customerProfile: { findMany: record('profiles', profiles) },
    sale: { findMany: record('sales', [
      { customerId: 35, totalAmount: 1000, paidAmount: 400 },
      { customerId: 102, totalAmount: 800, paidAmount: 300 },
      { customerId: 7, totalAmount: 200, paidAmount: 0 },
    ]) },
    customerReceipt: { findMany: record('receipts', [{ customerId: 35, remainingAmount: 40000 }, { customerId: 7, remainingAmount: 90 }]) },
    customerDeposit: { findMany: record('deposits', [{ customerId: 102, totalAmount: 5000, usedAmount: 0 }]) },
    customerMoneySettlementLine: { findMany: record('reservations', [{ appliedAmount: 1000, settlement: { customerId: 35 } }]) },
  };
  const repository = loadRepository(prisma);
  const projection = await repository.getFinancialProjection({ branchId: 2, customers: [
    { ...profiles[0], depositBalance_v2: 0, outstandingDebt_v2: 0 },
    { ...profiles[1], depositBalance_v2: 0, outstandingDebt_v2: 0 },
    { ...profiles[2], depositBalance_v2: 9999, outstandingDebt_v2: 9999 },
  ] });

  assert.deepEqual(projection.get(35), {
    financialGroupStatus: 'OWNER', financialOwnerCustomerId: null, financialOwner: null,
    memberOutstandingDebt: 600, groupOutstandingDebt: 1100,
    groupAvailableCustomerMoney: 44000, groupMemberCount: 2,
  });
  assert.equal(projection.get(102).financialGroupStatus, 'MEMBER');
  assert.equal(projection.get(102).financialOwner.id, 35);
  assert.equal(projection.get(102).memberOutstandingDebt, 500);
  assert.equal(projection.get(102).groupOutstandingDebt, 1100);
  assert.equal(projection.get(102).groupAvailableCustomerMoney, 44000);
  assert.equal(projection.get(7).financialGroupStatus, 'STANDALONE');
  assert.equal(projection.get(7).groupAvailableCustomerMoney, 90, 'stale depositBalance_v2 must not be authority');
  assert.equal(calls.length, 5, 'query count must stay constant rather than grow per customer');
  for (const [, args] of calls) assert.equal(args.where.branchId ?? args.where.settlement?.branchId, 2);
  assert.deepEqual(calls[0][1].where.OR, [
    { id: { in: [35, 7] } },
    { id: { in: [35, 102, 7] } },
    { financialOwnerCustomerId: { in: [35, 7] } },
  ]);
});

test('presentation keeps standalone fields compatible and member money explicitly group-scoped', () => {
  const repository = loadRepository({});
  const servicePath = require.resolve('./customerManagementService');
  delete require.cache[servicePath];
  const { presentCustomer } = require(servicePath);
  const base = { id: 7, branchId: 2, user: {}, depositBalance_v2: 9999, outstandingDebt_v2: 9999 };
  const standalone = presentCustomer(base, { financialGroupStatus: 'STANDALONE', financialOwnerCustomerId: null, financialOwner: null, memberOutstandingDebt: 200, groupOutstandingDebt: 200, groupAvailableCustomerMoney: 90, groupMemberCount: 1 });
  assert.equal(standalone.depositBalance, 90);
  assert.equal(standalone.outstandingDebt, 200);
  const member = presentCustomer({ ...base, id: 102 }, { financialGroupStatus: 'MEMBER', financialOwnerCustomerId: 35, financialOwner: { id: 35, companyName: 'เทศบาล', departmentName: 'สำนักปลัด' }, memberOutstandingDebt: 500, groupOutstandingDebt: 1100, groupAvailableCustomerMoney: 44000, groupMemberCount: 2 });
  assert.equal(member.memberOutstandingDebt, 500);
  assert.equal(member.groupAvailableCustomerMoney, 44000);
  assert.equal(member.financialOwner.id, 35);
});
