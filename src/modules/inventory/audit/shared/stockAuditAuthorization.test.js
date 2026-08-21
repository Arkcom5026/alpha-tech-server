const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  STOCK_AUDIT_CAPABILITY,
  allowStockAuditCapabilities,
} = require('./stockAuditAuthorization');

const runGuard = (user, ...capabilities) => {
  let nextError;
  let nextCalls = 0;
  const guard = allowStockAuditCapabilities(...capabilities);
  guard({ user }, {}, (error) => {
    nextCalls += 1;
    nextError = error;
  });
  return { nextCalls, nextError };
};

test('legacy employee roles preserve stock audit behavior while positions migrate', () => {
  const legacyCashier = {
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: null,
  };
  const result = runGuard(
    legacyCashier,
    STOCK_AUDIT_CAPABILITY.ACCESS,
    STOCK_AUDIT_CAPABILITY.FINALIZE,
  );

  assert.equal(result.nextCalls, 1);
  assert.equal(result.nextError, undefined);
});

test('migrated position needs explicit audit access capability', () => {
  const result = runGuard(
    {
      role: 'EMPLOYEE',
      employeeRole: 'MANAGER',
      positionCapabilities: [],
    },
    STOCK_AUDIT_CAPABILITY.ACCESS,
  );

  assert.equal(result.nextCalls, 1);
  assert.equal(result.nextError?.code, 'STOCK_AUDIT_FORBIDDEN');
  assert.equal(result.nextError?.statusCode, 403);
});

test('finalization requires both audit access and explicit finalize capability', () => {
  const accessOnly = runGuard(
    {
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: [STOCK_AUDIT_CAPABILITY.ACCESS],
    },
    STOCK_AUDIT_CAPABILITY.ACCESS,
    STOCK_AUDIT_CAPABILITY.FINALIZE,
  );
  assert.equal(accessOnly.nextError?.code, 'STOCK_AUDIT_FORBIDDEN');

  const complete = runGuard(
    {
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: [
        STOCK_AUDIT_CAPABILITY.ACCESS,
        STOCK_AUDIT_CAPABILITY.FINALIZE,
      ],
    },
    STOCK_AUDIT_CAPABILITY.ACCESS,
    STOCK_AUDIT_CAPABILITY.FINALIZE,
  );
  assert.equal(complete.nextError, undefined);
});

test('platform admin remains authorized regardless of migrated position capabilities', () => {
  const result = runGuard(
    {
      role: 'ADMIN',
      employeeRole: 'CASHIER',
      positionCapabilities: [],
    },
    STOCK_AUDIT_CAPABILITY.ACCESS,
    STOCK_AUDIT_CAPABILITY.FINALIZE,
  );
  assert.equal(result.nextError, undefined);
});

test('stock audit routes apply access and finalize capability boundaries', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '../routes/stockAuditRoutes.js'),
    'utf8',
  );

  assert.match(routes, /router\.get\('\/ready\/active', allowAuditAccess,/);
  assert.match(routes, /router\.post\('\/ready\/start', allowAuditAccess,/);
  assert.match(routes, /router\.post\('\/:sessionId\/scan', allowAuditAccess,/);
  assert.match(routes, /router\.post\('\/:sessionId\/scan-sn', allowAuditAccess,/);
  assert.match(routes, /router\.post\('\/:sessionId\/confirm', allowAuditFinalize,/);
  assert.match(routes, /router\.post\('\/:sessionId\/cancel', allowAuditFinalize,/);
  assert.match(routes, /router\.get\('\/:sessionId\/items', allowAuditAccess,/);
});
