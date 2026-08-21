const test = require('node:test');
const assert = require('node:assert/strict');

const {
  POSITION_CAPABILITIES,
} = require('../../../employee/authorization/employeePositionAuthority');
const {
  SALES_CAPABILITY,
  allowSalesCapabilities,
} = require('../../../sales/shared/salesAuthorization');

const runGuard = (user) => {
  let responseStatus;
  let responseBody;
  let nextCalls = 0;

  const guard = allowSalesCapabilities(
    SALES_CAPABILITY.CORE,
    SALES_CAPABILITY.COMPLETE,
  );
  guard(
    { user },
    {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return body;
      },
    },
    () => {
      nextCalls += 1;
    },
  );

  return { responseStatus, responseBody, nextCalls };
};

test('legacy sales roles retain mark-sold authority while positions migrate', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = runGuard({
      role: 'EMPLOYEE',
      employeeRole,
      positionCapabilities: null,
    });
    assert.equal(result.nextCalls, 1, employeeRole);
    assert.equal(result.responseStatus, undefined, employeeRole);
  }
});

test('migrated positions need both sales core and completion authority for mark-sold', () => {
  const cases = [
    { capabilities: [], allowed: false },
    { capabilities: [POSITION_CAPABILITIES.SALES_CORE], allowed: false },
    { capabilities: [POSITION_CAPABILITIES.SALES_COMPLETE], allowed: false },
    {
      capabilities: [
        POSITION_CAPABILITIES.SALES_CORE,
        POSITION_CAPABILITIES.SALES_COMPLETE,
      ],
      allowed: true,
    },
  ];

  for (const { capabilities, allowed } of cases) {
    const result = runGuard({
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: capabilities,
    });

    if (allowed) {
      assert.equal(result.nextCalls, 1);
      assert.equal(result.responseStatus, undefined);
    } else {
      assert.equal(result.nextCalls, 0);
      assert.equal(result.responseStatus, 403);
      assert.equal(result.responseBody?.code, 'SALES_AUTHORITY_FORBIDDEN');
    }
  }
});

test('platform admins retain mark-sold authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const result = runGuard({ role, positionCapabilities: [] });
    assert.equal(result.nextCalls, 1, role);
    assert.equal(result.responseStatus, undefined, role);
  }
});
