'use strict';

const { prisma } = require('../../../../../lib/prisma');

const ALLOWED_BRANCH_ID = 13;
const ALLOWED_BRANCH_SLUG = 'test-shop';

async function main() {
  const branch = await prisma.branch.findUnique({
    where: { id: ALLOWED_BRANCH_ID },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
    },
  });

  if (!branch) {
    throw new Error(`Repair E2E test tenant branch ${ALLOWED_BRANCH_ID} was not found.`);
  }
  if (branch.slug !== ALLOWED_BRANCH_SLUG) {
    throw new Error(
      `Repair E2E test tenant mismatch: expected slug ${ALLOWED_BRANCH_SLUG}, received ${branch.slug || 'NULL'}.`
    );
  }

  const employees = await prisma.employeeProfile.findMany({
    where: {
      branchId: ALLOWED_BRANCH_ID,
      active: true,
      approved: true,
      user: {
        enabled: true,
      },
    },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          enabled: true,
          loginId: true,
          loginType: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const customers = await prisma.customerProfile.findMany({
    where: {
      branchId: ALLOWED_BRANCH_ID,
      user: {
        enabled: true,
      },
    },
    select: {
      id: true,
      branchId: true,
      user: {
        select: {
          id: true,
          email: true,
          enabled: true,
          loginId: true,
          loginType: true,
        },
      },
    },
    orderBy: { id: 'asc' },
    take: 50,
  });

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: false,
    testTenant: branch,
    candidates: {
      operators: employees,
      customers,
    },
    nextEnvironment: {
      REPAIR_INTAKE_E2E_OPERATOR_EMAIL: employees[0]?.user?.email || null,
      REPAIR_INTAKE_E2E_CUSTOMER_ID: customers[0]?.id ? String(customers[0].id) : null,
    },
    notes: [
      'Choose an operator account whose existing password is known.',
      'The Main-DB fixture never resets operator credentials.',
      'Customer IDs shown here are scoped to branchId 13 only.',
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`REPAIR_E2E_TEST_TENANT_INSPECTION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
