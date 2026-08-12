'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveFinancialCustomerGroup, validateFinancialOwnerLink, sameLegalIdentity } = require('./customerFinancialGroupResolver');

const customers = [
  { id: 1, branchId: 10, type: 'ORGANIZATION', companyName: ' Alpha Tech ', taxId: '1-234', financialOwnerCustomerId: null },
  { id: 2, branchId: 10, type: 'ORGANIZATION', companyName: 'alpha   tech', taxId: '1234', financialOwnerCustomerId: 1 },
  { id: 3, branchId: 20, type: 'ORGANIZATION', companyName: 'Alpha Tech', taxId: '1234', financialOwnerCustomerId: null },
];
const client = { customerProfile: {
  findFirst: async ({ where }) => customers.find((item) => item.id === where.id && item.branchId === where.branchId && (where.financialOwnerCustomerId === undefined || item.financialOwnerCustomerId === where.financialOwnerCustomerId)) || null,
  findMany: async ({ where }) => customers.filter((item) => item.branchId === where.branchId && (item.id === where.OR[0].id || item.financialOwnerCustomerId === where.OR[1].financialOwnerCustomerId)),
} };

test('standalone and member resolve to a canonical owner with deterministic member ids', async () => {
  const root = await resolveFinancialCustomerGroup(client, { customerId: 1, branchId: 10 });
  const member = await resolveFinancialCustomerGroup(client, { customerId: 2, branchId: 10 });
  assert.equal(root.ownerId, 1);
  assert.equal(member.ownerId, 1);
  assert.deepEqual(member.memberIds, [1, 2]);
});

test('normalizes legal identity and rejects cross-branch owner lookup', async () => {
  assert.equal(sameLegalIdentity(customers[0], customers[1]), true);
  await assert.rejects(() => validateFinancialOwnerLink(client, { customer: customers[1], ownerId: 3, branchId: 10 }), { code: 'FINANCIAL_OWNER_NOT_FOUND' });
});

test('rejects individual membership and chained ownership', async () => {
  await assert.rejects(() => validateFinancialOwnerLink(client, { customer: { ...customers[1], type: 'INDIVIDUAL' }, ownerId: 1, branchId: 10 }), { code: 'FINANCIAL_GROUP_TYPE_UNSUPPORTED' });
  await assert.rejects(() => validateFinancialOwnerLink(client, { customer: customers[0], ownerId: 2, branchId: 10 }), { code: 'FINANCIAL_GROUP_CHAIN_FORBIDDEN' });
});
