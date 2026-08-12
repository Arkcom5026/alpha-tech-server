'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const repository = read('src/modules/customer/management/customerManagementRepository.js');
const service = read('src/modules/customer/management/customerManagementService.js');

assert.match(repository, /getFinancialProjection/);
assert.match(repository, /status:\s*\{ in: \['DELIVERED', 'FINALIZED', 'COMPLETED'\] \}/);
assert.match(repository, /customerReceipt\.findMany/);
assert.match(repository, /customerDeposit\.findMany/);
assert.match(repository, /customerMoneySettlementLine\.findMany/);
const projectionSource = repository.slice(repository.indexOf('async function getFinancialProjection'), repository.indexOf('function claimLegacyCustomer'));
assert.doesNotMatch(projectionSource, /depositBalance_v2/);
assert.match(service, /listCustomers[\s\S]*getFinancialProjection/);
assert.match(service, /getCustomerDetail[\s\S]*getFinancialProjection/);
for (const field of ['financialGroupStatus', 'financialOwner', 'memberOutstandingDebt', 'groupOutstandingDebt', 'groupAvailableCustomerMoney', 'groupMemberCount']) assert.match(service, new RegExp(field));
console.log('customer-management-financial-projection.contract: PASS');
