'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../../../../../recovery/testDatabaseAuthority');

const APPROVAL = 'ALPHATECH_REPAIR_INTAKE_E2E_FIXTURE';
const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
assertTestDatabaseAuthority({ targetUrl, env: authorityEnv, requiresWriteApproval: true });

if (process.env.REPAIR_INTAKE_E2E_FIXTURE_APPROVAL !== APPROVAL) {
  throw new Error(`Set REPAIR_INTAKE_E2E_FIXTURE_APPROVAL=${APPROVAL} before provisioning.`);
}

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name} in process environment or .env.restore.`);
  return value;
};

const operatorEmail = required('REPAIR_INTAKE_E2E_OPERATOR_EMAIL').toLowerCase();
const operatorPassword = required('REPAIR_INTAKE_E2E_OPERATOR_PASSWORD');
const customerId = Number(required('REPAIR_INTAKE_E2E_CUSTOMER_ID'));
if (!Number.isInteger(customerId) || customerId <= 0) {
  throw new Error('REPAIR_INTAKE_E2E_CUSTOMER_ID must be a positive integer.');
}

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
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

  const passwordHash = await bcrypt.hash(operatorPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      enabled: true,
    },
  });

  const branch = await prisma.branch.findUnique({
    where: { id: Number(employee.branchId) },
    select: { id: true, slug: true },
  });
  if (!branch?.slug) throw new Error('The operator branch must have a slug.');

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
      internalRemark: `Test DB only; retained fixture ${runToken}`,
      accessories: [],
      depositPaid: 0,
      estimatedCost: 0,
    }
  );

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    runToken,
    fixture: {
      branchId: branch.id,
      branchSlug: branch.slug,
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
    safety: 'Creates a fresh Test-DB-only external device, intake, and RepairJob; production is forbidden.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`REPAIR_INTAKE_E2E_FIXTURE_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
