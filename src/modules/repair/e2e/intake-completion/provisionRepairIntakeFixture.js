'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  resolveRepairIntakeE2ERuntimeAuthority,
} = require('./repairIntakeE2ERuntimeAuthority');

const authority = resolveRepairIntakeE2ERuntimeAuthority({ requiresWrite: true });

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} in the selected E2E runtime environment.`);
  return value;
};

const operatorEmail = required('REPAIR_INTAKE_E2E_OPERATOR_EMAIL').toLowerCase();
const operatorPassword = authority.mayMutateOperatorCredential
  ? required('REPAIR_INTAKE_E2E_OPERATOR_PASSWORD')
  : null;
const customerId = Number(required('REPAIR_INTAKE_E2E_CUSTOMER_ID'));
if (!Number.isInteger(customerId) || customerId <= 0) {
  throw new Error('REPAIR_INTAKE_E2E_CUSTOMER_ID must be a positive integer.');
}

process.env.DATABASE_URL = authority.targetUrl;
process.env.DIRECT_URL = authority.targetUrl;
const { prisma } = require('../../../../../lib/prisma');
const {
  CreateExternalDeviceIntakeService,
} = require('../../external-intake/createExternalDeviceIntakeService');
const externalRepository = require('../../external-intake/externalDeviceIntakeRepository');

async function main() {
  const runToken = crypto.randomBytes(8).toString('hex').toUpperCase();
  const user = await prisma.user.findUnique({
    where: { email: operatorEmail },
    include: { employeeProfile: true },
  });
  const employee = user?.employeeProfile;
  if (!employee?.id || !employee.branchId || !employee.active || !employee.approved) {
    throw new Error('The configured operator is not an active approved employee with a branch.');
  }

  if (authority.mayMutateOperatorCredential) {
    const passwordHash = await bcrypt.hash(operatorPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        enabled: true,
      },
    });
  } else if (!user.enabled) {
    throw new Error('The Main-DB E2E operator must already be enabled; fixture cannot change credentials.');
  }

  const branch = await prisma.branch.findUnique({
    where: { id: Number(employee.branchId) },
    select: { id: true, slug: true, name: true },
  });
  if (!branch?.slug) throw new Error('The operator branch must have a slug.');

  if (
    authority.expectedBranch
    && (
      branch.id !== authority.expectedBranch.branchId
      || branch.slug !== authority.expectedBranch.branchSlug
    )
  ) {
    throw new Error(
      `Main-DB Repair E2E operator must belong to branchId=${authority.expectedBranch.branchId}, `
        + `slug=${authority.expectedBranch.branchSlug}; received branchId=${branch.id}, slug=${branch.slug}.`
    );
  }

  const customer = await externalRepository.findCustomer(branch.id, customerId);
  if (!customer) {
    throw new Error(
      'The configured customer has no branch-authority evidence for the operator branch.'
    );
  }

  const service = new CreateExternalDeviceIntakeService(externalRepository);
  const created = await service.execute(
    { branchId: branch.id, employeeId: employee.id },
    {
      customerId: customer.id,
      device: {
        category: 'NOTEBOOK',
        brand: 'E2E',
        model: `Repair Intake ${runToken}`,
        serialNumber: `E2E-REPAIR-SN-${runToken}`,
        barcode: `E2E-REPAIR-DEVICE-${runToken}`,
      },
      customerProblem: `Repair intake completion Browser E2E ${runToken}`,
      internalRemark: `${authority.environment} retained fixture ${runToken}`,
      accessories: [],
      depositPaid: 0,
      estimatedCost: 0,
    }
  );

  console.log(JSON.stringify({
    result: 'PASS',
    environment: authority.environment,
    runtimeAuthority: authority.target,
    runToken,
    fixture: {
      branchId: branch.id,
      branchSlug: branch.slug,
      branchName: branch.name,
      employeeId: employee.id,
      customerId: customer.id,
      operatorEmail,
      repairJobId: created.repairJob.id,
      repairJobNo: created.repairJob.jobNo,
      deviceId: created.device.id,
      deviceIntakeId: created.deviceIntake.id,
      initialStatus: created.repairJob.status,
    },
    browserEnvironment: {
      E2E_TEST_USERNAME: operatorEmail,
      REPAIR_INTAKE_E2E_BRANCH_SLUG: branch.slug,
      REPAIR_INTAKE_E2E_JOB_ID: String(created.repairJob.id),
      REPAIR_INTAKE_E2E_JOB_NO: created.repairJob.jobNo,
      REPAIR_INTAKE_E2E_RUN_TOKEN: runToken,
    },
    retainedTestData: true,
    safety: authority.expectedBranch
      ? 'Creates data only through the fixed Main-DB test tenant; operator credentials are never changed.'
      : 'Creates a fresh dedicated-Test-DB external device, intake, and RepairJob.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`REPAIR_INTAKE_E2E_FIXTURE_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
