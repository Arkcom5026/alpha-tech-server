'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  QUOTATION_CAPABILITY,
  allowQuotationCapabilities,
} = require('./quotationAuthorization');

const runGuard = (user, ...capabilities) => {
  let nextCalls = 0;
  let responseStatus = null;
  let responseBody = null;
  const response = {
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return body;
    },
  };

  allowQuotationCapabilities(...capabilities)({ user }, response, () => {
    nextCalls += 1;
  });

  return { nextCalls, responseStatus, responseBody };
};

const allCapabilities = Object.values(QUOTATION_CAPABILITY);

test('legacy quotation authority preserves historical employee access while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    }, ...allCapabilities);

    assert.equal(result.nextCalls, 1, employeeRole);
    assert.equal(result.responseStatus, null, employeeRole);
  }
});

test('migrated positions separate quotation read, manage, issue and lifecycle authority', () => {
  const readOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [QUOTATION_CAPABILITY.READ],
  };

  assert.equal(runGuard(readOnly, QUOTATION_CAPABILITY.READ).nextCalls, 1);

  for (const capability of [
    QUOTATION_CAPABILITY.MANAGE,
    QUOTATION_CAPABILITY.ISSUE,
    QUOTATION_CAPABILITY.LIFECYCLE,
  ]) {
    const denied = runGuard(readOnly, QUOTATION_CAPABILITY.READ, capability);
    assert.equal(denied.nextCalls, 0, capability);
    assert.equal(denied.responseStatus, 403, capability);
    assert.equal(denied.responseBody?.code, 'QUOTATION_AUTHORITY_FORBIDDEN', capability);
  }

  const empty = runGuard({
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  }, QUOTATION_CAPABILITY.READ);
  assert.equal(empty.responseStatus, 403);
});

test('platform admins pass quotation capability checks', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const result = runGuard({ role, positionCapabilities: [] }, ...allCapabilities);
    assert.equal(result.nextCalls, 1, role);
  }
});

test('quotation routes preserve employee actor context and split route authority', () => {
  const routes = fs.readFileSync(path.join(__dirname, 'quotationRoutes.js'), 'utf8');

  assert.match(routes, /router\.use\(requireEmployeeContext\)/);
  assert.match(routes, /QUOTATION_EMPLOYEE_AUTHORITY_REQUIRED/);

  assert.match(routes, /router\.get\('\/', allowQuotationRead,/);
  assert.match(routes, /router\.get\('\/reference-candidates', allowQuotationRead,/);
  assert.match(routes, /router\.get\('\/:quotationId', allowQuotationRead,/);
  assert.match(routes, /router\.get\('\/:quotationId\/revisions', allowQuotationRead,/);
  assert.match(routes, /router\.get\('\/:quotationId\/lineage', allowQuotationRead,/);

  assert.match(routes, /router\.post\('\/', allowQuotationManage,/);
  assert.match(routes, /router\.post\('\/:quotationId\/revisions', allowQuotationManage,/);
  assert.match(routes, /router\.put\('\/:quotationId', allowQuotationManage,/);
  assert.match(routes, /router\.post\('\/:quotationId\/items', allowQuotationManage,/);
  assert.match(routes, /router\.put\('\/:quotationId\/items\/:lineId', allowQuotationManage,/);
  assert.match(routes, /router\.delete\('\/:quotationId\/items\/:lineId', allowQuotationManage,/);

  assert.match(routes, /router\.post\('\/:quotationId\/issue', allowQuotationIssue,/);
  assert.match(routes, /router\.post\('\/:quotationId\/accept', allowQuotationLifecycle,/);
  assert.match(routes, /router\.post\('\/:quotationId\/reject', allowQuotationLifecycle,/);
  assert.match(routes, /router\.post\('\/:quotationId\/cancel', allowQuotationLifecycle,/);
});
