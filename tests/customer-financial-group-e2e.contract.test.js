'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('combined billing resolves one owner and admits sales from all group members', () => {
  const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  const repository = read('src/modules/finance/combined-billing/create/createCombinedBillingDocumentRepository.js');
  assert.match(workspace, /resolveFinancialCustomerGroup/);
  assert.match(workspace, /customerId: \{ in: group\.memberIds \}/);
  assert.match(workspace, /customerId: group\.ownerId/);
  assert.match(repository, /group\.memberIds\.includes\(sale\.customerId\)/);
});

test('tax uses legal owner while delivery note keeps operational department identity', () => {
  const tax = read('src/modules/tax/sources/sale/registerSaleTaxCandidateService.js');
  const delivery = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
  assert.match(tax, /legalCustomer/);
  assert.match(tax, /financialOwnerCustomerId: group\?\.ownerId/);
  assert.match(tax, /sourceDepartmentName: sale\.customer\?\.departmentName/);
  assert.match(delivery, /departmentName: sale\.customer\?\.departmentName/);
  assert.match(delivery, /operationalAddress: sale\.customer\?\.addressDetail/);
});

test('finance preserves member rows and exposes owner group totals', () => {
  const finance = read('src/modules/finance/runtime/financeRuntimeRepository.js');
  assert.match(finance, /groupOutstandingAmount/);
  assert.match(finance, /groupMembers/);
  assert.match(finance, /totalFinancialGroups/);
  assert.match(finance, /buildActiveCreditReceivableWhere\(\{ branchId: input\.branchId, customerIds: group\.memberIds \}\)/);
});

test('linked customer self-service cannot mutate legal authority fields', () => {
  const self = read('src/modules/customer/update/self/customerSelfUpdateService.js');
  assert.match(self, /existing\.financialOwnerCustomerId/);
  assert.match(self, /delete profileData\.companyName/);
  assert.match(self, /delete profileData\.taxId/);
});
