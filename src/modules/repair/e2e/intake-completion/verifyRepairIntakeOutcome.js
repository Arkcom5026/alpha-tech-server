'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../../../../../recovery/testDatabaseAuthority');

const repairJobId = Number(process.argv[2] || process.env.REPAIR_INTAKE_E2E_JOB_ID);
if (!Number.isInteger(repairJobId) || repairJobId <= 0) {
  throw new Error('Usage: node verifyRepairIntakeOutcome.js <repair-job-id>');
}

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../../../../../lib/prisma');

const fail = (message, details = {}) => {
  console.log(JSON.stringify({
    result: 'FAIL',
    databaseModified: false,
    repairJobId,
    authority: authority.target,
    message,
    details,
  }, null, 2));
  process.exitCode = 2;
};

async function main() {
  const job = await prisma.repairJob.findUnique({
    where: { id: repairJobId },
    select: {
      id: true,
      jobNo: true,
      branchId: true,
      customerId: true,
      deviceId: true,
      status: true,
      deviceIntake: {
        select: {
          id: true,
          branchId: true,
          repairJobId: true,
          customerId: true,
          deviceId: true,
          consent: {
            select: {
              id: true,
              customerSignature: true,
              confirmed: true,
              signedAt: true,
            },
          },
          photos: {
            select: {
              id: true,
              category: true,
              url: true,
              uploadedByEmployeeId: true,
            },
          },
        },
      },
    },
  });

  if (!job) return fail('Fixture RepairJob was not found.');
  if (job.status !== 'IN_PROGRESS') {
    return fail('RepairJob did not reach IN_PROGRESS.', { status: job.status });
  }

  const intake = job.deviceIntake;
  if (!intake) return fail('DeviceIntake evidence is missing.');
  if (intake.branchId !== job.branchId || intake.repairJobId !== job.id) {
    return fail('DeviceIntake authority does not match RepairJob.', { job, intake });
  }
  if (intake.customerId !== job.customerId || intake.deviceId !== job.deviceId) {
    return fail('DeviceIntake customer/device authority does not match RepairJob.', { job, intake });
  }

  if (!intake.consent?.confirmed || intake.consent.customerSignature !== 'Repair E2E Customer') {
    return fail('Required customer consent evidence is incomplete.', { consent: intake.consent });
  }

  const conditionPhoto = intake.photos.find(
    (photo) => String(photo.category || '').toUpperCase() === 'INTAKE_CONDITION'
  );
  if (!conditionPhoto) {
    return fail('No INTAKE_CONDITION photo evidence was found.', { photos: intake.photos });
  }

  const events = await prisma.$queryRaw`
    SELECT "id", "repairJobId", "eventType", "fromStatus", "toStatus",
           "performedByEmployeeId", "occurredAt"
    FROM "RepairJobEvent"
    WHERE "repairJobId" = ${job.id}
      AND "eventType" = 'STATUS_CHANGED'
      AND "fromStatus" = 'RECEIVED'
      AND "toStatus" = 'IN_PROGRESS'
    ORDER BY "occurredAt" DESC
    LIMIT 5
  `;
  if (!events.length) return fail('Matching status timeline event was not found.');

  console.log(JSON.stringify({
    result: 'PASS',
    databaseModified: false,
    authority: authority.target,
    repairJob: {
      id: job.id,
      jobNo: job.jobNo,
      branchId: job.branchId,
      customerId: job.customerId,
      deviceId: job.deviceId,
      status: job.status,
    },
    intake: {
      id: intake.id,
      branchId: intake.branchId,
      consentId: intake.consent.id,
      conditionPhotoId: conditionPhoto.id,
      uploadedByEmployeeId: conditionPhoto.uploadedByEmployeeId,
    },
    timelineEvent: events[0],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`REPAIR_INTAKE_E2E_OUTCOME_VERIFICATION_FAILED: ${error.message || error}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
