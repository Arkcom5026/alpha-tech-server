'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
assertTestDatabaseAuthority({ targetUrl, env: authorityEnv, requiresWriteApproval: false });

const requiredInt = (name) => {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`Missing or invalid ${name}.`);
  return value;
};

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

const expected = [
  {
    label: 'REJECT',
    id: requiredInt('PRODUCT_TEMPLATE_E2E_REJECT_CANDIDATE_ID'),
    status: 'REJECTED',
    eventType: 'REJECTED',
  },
  {
    label: 'MERGE',
    id: requiredInt('PRODUCT_TEMPLATE_E2E_MERGE_CANDIDATE_ID'),
    status: 'MERGED',
    eventType: 'MERGED',
    targetTemplateProductId: requiredInt('PRODUCT_TEMPLATE_E2E_TARGET_TEMPLATE_PRODUCT_ID'),
  },
  {
    label: 'PROMOTE',
    id: requiredInt('PRODUCT_TEMPLATE_E2E_PROMOTE_CANDIDATE_ID'),
    status: 'PROMOTED',
    eventType: 'PROMOTED',
  },
];

async function main() {
  const results = [];

  for (const item of expected) {
    const candidate = await prisma.productTemplateCandidate.findUnique({
      where: { id: item.id },
      select: {
        id: true,
        status: true,
        sourceBranchId: true,
        sourceProductId: true,
        targetTemplateBranchId: true,
        targetTemplateProductId: true,
        reviewedByEmployeeId: true,
        decisionNote: true,
        reviewedAt: true,
        promotedAt: true,
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            eventType: true,
            previousStatus: true,
            resultingStatus: true,
            actorEmployeeId: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!candidate) throw new Error(`${item.label} candidate ${item.id} not found.`);
    if (candidate.status !== item.status) {
      throw new Error(`${item.label} candidate ${item.id} expected ${item.status}, got ${candidate.status}.`);
    }
    if (!candidate.events.some((event) => event.eventType === 'CREATED')) {
      throw new Error(`${item.label} candidate ${item.id} has no CREATED event.`);
    }
    if (!candidate.events.some((event) => event.eventType === 'REVIEW_STARTED')) {
      throw new Error(`${item.label} candidate ${item.id} has no REVIEW_STARTED event.`);
    }
    if (!candidate.events.some((event) => event.eventType === item.eventType && event.resultingStatus === item.status)) {
      throw new Error(`${item.label} candidate ${item.id} has no ${item.eventType} terminal event.`);
    }
    if (item.targetTemplateProductId && candidate.targetTemplateProductId !== item.targetTemplateProductId) {
      throw new Error(`${item.label} candidate ${item.id} target template mismatch.`);
    }
    if (item.status === 'PROMOTED' && !candidate.targetTemplateProductId) {
      throw new Error(`PROMOTE candidate ${item.id} has no created targetTemplateProductId.`);
    }

    results.push({ label: item.label, ...candidate });
  }

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    verifiedCandidates: results,
    authority: 'Database post-condition verifier; read-only.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
