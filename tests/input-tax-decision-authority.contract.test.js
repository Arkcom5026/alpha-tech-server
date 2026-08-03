'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/tax/inputDocuments/decisions/inputTaxDecisionRepository.js');
const service = read('src/modules/tax/inputDocuments/decisions/inputTaxDecisionService.js');
const controller = read('src/modules/tax/inputDocuments/decisions/inputTaxDecisionController.js');
const routes = read('src/modules/tax/inputDocuments/decisions/inputTaxDecisionRoutes.js');
const taxRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');

assert.match(repository, /FOR UPDATE/);
assert.match(repository, /replaceSnapshot/);
assert.match(repository, /TaxDocumentLifecycleEvent/);

assert.match(service, /CONFIRMED_DUPLICATE/);
assert.match(service, /RESOLVED_NOT_DUPLICATE/);
assert.match(service, /INPUT_TAX_REPLACEMENT_SELF_REFERENCE/);
assert.match(service, /INPUT_TAX_REPLACEMENT_ALREADY_LINKED/);
assert.match(service, /INPUT_TAX_REPLACEMENT_CYCLE/);
assert.match(service, /prisma\.\$transaction/);
assert.match(service, /inputTaxDuplicateDecidedByEmployeeId/);
assert.match(service, /inputTaxReplacementDecidedByEmployeeId/);

assert.match(controller, /OWNER/);
assert.match(controller, /MANAGER/);
assert.match(controller, /INPUT_TAX_DECISION_BRANCH_FORBIDDEN/);

assert.match(routes, /duplicate-decision/);
assert.match(routes, /replacement-link/);
assert.match(taxRoutes, /inputTaxDecisionRoutes/);

console.log('input tax decision authority contract: PASS');
