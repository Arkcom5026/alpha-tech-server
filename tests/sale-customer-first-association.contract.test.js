const test = require('node:test');
const assert = require('node:assert/strict');

process.env.CUSTOMER_FIRST_ASSOCIATION_SECRET = 'sale-first-association-contract-secret';

const {
  issueCustomerFirstAssociationToken,
  verifyCustomerFirstAssociationToken,
} = require('../src/modules/customer/policies/customerFirstAssociationTokenPolicy');
const {
  SaleCustomerAccessService,
} = require('../src/modules/sales/completion/services/saleCustomerAccessService');

const claims = { customerId: 45, branchId: 2, employeeId: 35 };

test('first-association token is bound to customer, branch, employee and expiry', () => {
  const now = Date.UTC(2026, 7, 3, 3, 0, 0);
  const token = issueCustomerFirstAssociationToken({ ...claims, now });
  assert.equal(verifyCustomerFirstAssociationToken(token, claims, now + 1000), true);
  assert.equal(verifyCustomerFirstAssociationToken(token, { ...claims, branchId: 3 }, now + 1000), false);
  assert.equal(verifyCustomerFirstAssociationToken(token, { ...claims, employeeId: 36 }, now + 1000), false);
  assert.equal(verifyCustomerFirstAssociationToken(token, { ...claims, customerId: 46 }, now + 1000), false);
  assert.equal(verifyCustomerFirstAssociationToken(token, claims, now + 16 * 60 * 1000), false);
});

test('sale accepts a newly created customer only with matching signed evidence', async () => {
  const token = issueCustomerFirstAssociationToken(claims);
  const repository = {
    findAccessibleCustomer: async () => null,
    findCustomerById: async (id) => ({ id, type: 'INDIVIDUAL', paymentTerms: null }),
  };
  const service = new SaleCustomerAccessService(repository);
  const customer = await service.assertAccessible({
    ...claims,
    customerFirstAssociationToken: token,
  });
  assert.equal(customer.id, claims.customerId);
});

test('sale rejects missing or forged first-association evidence', async () => {
  const repository = {
    findAccessibleCustomer: async () => null,
    findCustomerById: async () => ({ id: claims.customerId }),
  };
  const service = new SaleCustomerAccessService(repository);
  await assert.rejects(
    service.assertAccessible(claims),
    { code: 'SALE_CUSTOMER_NOT_ACCESSIBLE_IN_BRANCH', status: 404 }
  );
  const token = issueCustomerFirstAssociationToken(claims);
  await assert.rejects(
    service.assertAccessible({
      ...claims,
      branchId: 3,
      customerFirstAssociationToken: token,
    }),
    { code: 'SALE_CUSTOMER_NOT_ACCESSIBLE_IN_BRANCH', status: 404 }
  );
});
