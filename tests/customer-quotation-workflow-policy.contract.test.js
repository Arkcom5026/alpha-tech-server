'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const includes = (source, token) => {
  if (!source.includes(token)) throw new Error(`Missing customer quotation workflow contract: ${token}`);
};

const schema = read('prisma/customer/customer.prisma');
const migration = read('prisma/migrations/20260819020500_customer_quotation_workflow_override/migration.sql');
const policySource = read('src/modules/customer/policies/customerQuotationWorkflowPolicy.js');
const candidateService = read('src/modules/quotation/quotationReferenceCandidateService.js');
const searchRepository = read('src/modules/customer/query/search/customerSearchRepository.js');
const searchService = read('src/modules/customer/query/search/customerSearchService.js');
const managementRepository = read('src/modules/customer/management/customerManagementRepository.js');
const managementService = read('src/modules/customer/management/customerManagementService.js');
const createService = read('src/modules/customer/create/customerCreateService.js');
const createRepository = read('src/modules/customer/create/customerCreateRepository.js');
const updateService = read('src/modules/customer/update/staff/customerStaffUpdateService.js');

includes(schema, 'quotationWorkflowOverride Boolean?');
includes(migration, 'ADD COLUMN "quotationWorkflowOverride" BOOLEAN');
for (const token of [
  "String(customer.type || 'INDIVIDUAL').toUpperCase() === 'GOVERNMENT'",
  'if (override !== null) return override;',
  'quotationWorkflowEnabled: isQuotationWorkflowEnabled(customer)',
]) includes(policySource, token);

const policy = require('../src/modules/customer/policies/customerQuotationWorkflowPolicy');
const cases = [
  [{ type: 'GOVERNMENT', quotationWorkflowOverride: null }, true, 'government default'],
  [{ type: 'ORGANIZATION', quotationWorkflowOverride: null }, false, 'organization default'],
  [{ type: 'INDIVIDUAL', quotationWorkflowOverride: null }, false, 'individual default'],
  [{ type: 'ORGANIZATION', quotationWorkflowOverride: true }, true, 'organization explicit enable'],
  [{ type: 'GOVERNMENT', quotationWorkflowOverride: false }, false, 'government explicit disable'],
];
for (const [customer, expected, label] of cases) {
  if (policy.isQuotationWorkflowEnabled(customer) !== expected) {
    throw new Error(`Quotation workflow policy failed: ${label}`);
  }
}

for (const token of [
  'projectQuotationWorkflowPolicy(customer)',
  'if (!workflow.quotationWorkflowEnabled)',
  'return { ...workflow, candidates: [] };',
  "status: 'ACCEPTED'",
  'revisedTo: { is: null }',
]) includes(candidateService, token);
if (candidateService.indexOf('if (!workflow.quotationWorkflowEnabled)') > candidateService.indexOf('prisma.quotation.findMany')) {
  throw new Error('Quotation candidate query must be gated before quotation lookup');
}
includes(searchRepository, 'quotationWorkflowOverride: true');
includes(managementRepository, 'quotationWorkflowOverride: true');
for (const source of [searchService, managementService, createService, updateService]) {
  includes(source, 'projectQuotationWorkflowPolicy');
}
includes(createRepository, 'quotationWorkflowOverride: customer.quotationWorkflowOverride ?? null');
includes(updateService, 'quotationWorkflowOverride,');
includes(updateService, 'INVALID_QUOTATION_WORKFLOW_OVERRIDE');

console.log('Customer Quotation Workflow Policy Contract: PASS');
