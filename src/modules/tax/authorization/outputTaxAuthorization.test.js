'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');
const {
  OUTPUT_TAX_CAPABILITY,
} = require('./outputTaxAuthorization');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

test('legacy tax authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    const actor = { role: 'EMPLOYEE', employeeRole, positionCapabilities: null };
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.READ), true);
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.PREPARE), true);
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.ISSUE), true);
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.CREDIT_NOTE), true);
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.LIFECYCLE), true);
  }

  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole, positionCapabilities: null };
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.READ), false);
    assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.ISSUE), false);
  }
});

test('migrated positions require explicit output tax capabilities', () => {
  const actor = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [POSITION_CAPABILITIES.TAX_OUTPUT_READ],
  };

  assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.READ), true);
  assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.PREPARE), false);
  assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.ISSUE), false);
  assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.CREDIT_NOTE), false);
  assert.equal(hasCapability(actor, OUTPUT_TAX_CAPABILITY.LIFECYCLE), false);
});

test('platform admin retains all output tax authority', () => {
  const actor = { role: 'ADMIN', positionCapabilities: [] };
  for (const capability of Object.values(OUTPUT_TAX_CAPABILITY)) {
    assert.equal(hasCapability(actor, capability), true);
  }
});

test('output tax routes separate read, prepare, issue, credit-note and lifecycle authority', () => {
  const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
  const controller = read('src/modules/tax/http/taxIntakeController.js');

  assert.match(routes, /router\.post\('\/candidates\/register', allowOutputTaxPrepare, controller\.registerCandidate\)/);
  assert.match(routes, /router\.get\('\/documents', allowOutputTaxRead, controller\.listDocuments\)/);
  assert.match(routes, /router\.get\('\/documents\/:taxDocumentId\/presentation', allowOutputTaxRead, getStatutoryTaxPresentation\)/);
  assert.match(routes, /router\.post\('\/documents\/:taxDocumentId\/issue', allowOutputTaxIssue, controller\.issueOutputTaxDocument\)/);
  assert.match(routes, /router\.post\('\/documents\/:taxDocumentId\/credit-note', allowOutputTaxCreditNote, controller\.issueOutputTaxCreditNote\)/);
  assert.match(routes, /router\.post\('\/documents\/:taxDocumentId\/transition', allowOutputTaxLifecycle, controller\.transitionDocument\)/);

  assert.doesNotMatch(controller, /Tax intake requires OWNER or MANAGER authority/);
  assert.doesNotMatch(controller, /\['OWNER', 'MANAGER'\]/);
  assert.match(controller, /TAX_INTAKE_BRANCH_FORBIDDEN/);
});
