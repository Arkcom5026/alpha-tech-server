'use strict';

const { prisma } = require('../../../../../lib/prisma');
const customerCreateService = require('../../../../customer/create/customerCreateService');

const ALLOWED_BRANCH_ID = 13;
const ALLOWED_BRANCH_SLUG = 'test-shop';
const APPROVAL = 'ALPHATECH_REPAIR_E2E_TEST_CUSTOMER_WRITE';
const TEST_CUSTOMER_PHONE = '0991300013';
const TEST_CUSTOMER_NAME = '[E2E] Repair Test Customer';

async function main() {
  if (process.env.REPAIR_INTAKE_E2E_TEST_CUSTOMER_WRITE_APPROVAL !== APPROVAL) {
    throw new Error(
      `Set REPAIR_INTAKE_E2E_TEST_CUSTOMER_WRITE_APPROVAL=${APPROVAL} before provisioning.`
    );
  }

  const branch = await prisma.branch.findUnique({
    where: { id: ALLOWED_BRANCH_ID },
    select: { id: true, name: true, slug: true },
  });
  if (!branch || branch.slug !== ALLOWED_BRANCH_SLUG) {
    throw new Error('Repair E2E test tenant authority mismatch.');
  }

  const operator = await prisma.employeeProfile.findFirst({
    where: {
      branchId: ALLOWED_BRANCH_ID,
      active: true,
      approved: true,
      user: { enabled: true },
    },
    select: {
      id: true,
      user: { select: { id: true, email: true } },
    },
    orderBy: { id: 'asc' },
  });
  if (!operator?.id) {
    throw new Error('No active approved operator exists in Repair E2E test tenant.');
  }

  const result = await customerCreateService.createCustomer(
    {
      name: TEST_CUSTOMER_NAME,
      phone: TEST_CUSTOMER_PHONE,
      type: 'INDIVIDUAL',
      addressDetail: 'MAIN DB TEST TENANT ONLY',
    },
    {
      branchId: ALLOWED_BRANCH_ID,
      employeeId: operator.id,
    }
  );

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'MAIN_TEST_TENANT',
    created: result.statusCode === 201,
    statusCode: result.statusCode,
    testTenant: branch,
    operator: {
      employeeId: operator.id,
      email: operator.user?.email || null,
    },
    customer: {
      id: result.body.id,
      name: result.body.name,
      phone: result.body.phone,
    },
    nextEnvironment: {
      REPAIR_INTAKE_E2E_CUSTOMER_ID: String(result.body.id),
    },
    safety: 'Creates or reuses one deterministic customer profile only in branchId 13.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`REPAIR_E2E_TEST_CUSTOMER_PROVISION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
