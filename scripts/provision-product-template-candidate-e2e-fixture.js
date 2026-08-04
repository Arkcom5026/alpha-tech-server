'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const APPROVAL = 'ALPHATECH_PRODUCT_TEMPLATE_CANDIDATE_E2E_FIXTURE';
const envPath = path.join(process.cwd(), '.env.restore');

if (!fs.existsSync(envPath)) throw new Error('Missing .env.restore.');
dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
assertTestDatabaseAuthority({ targetUrl, env: authorityEnv, requiresWriteApproval: true });

if (process.env.PRODUCT_TEMPLATE_CANDIDATE_E2E_FIXTURE_APPROVAL !== APPROVAL) {
  throw new Error(`Set PRODUCT_TEMPLATE_CANDIDATE_E2E_FIXTURE_APPROVAL=${APPROVAL} before provisioning fixture data.`);
}

process.env.DATABASE_URL = targetUrl;
process.env.DIRECT_URL = targetUrl;
const { prisma } = require('../lib/prisma');

const makeProductData = ({ name, branchId, productTypeId }) => ({
  name,
  branchId,
  productTypeId,
  active: true,
  mode: 'STRUCTURED',
  noSN: true,
  trackSerialNumber: false,
  productConfig: { fixture: 'PRODUCT_TEMPLATE_CANDIDATE_BROWSER_E2E' },
});

async function main() {
  const runToken = crypto.randomBytes(6).toString('hex').toUpperCase();
  const branchSlug = `system-test-template-candidate-${runToken.toLowerCase()}`;

  const fixture = await prisma.$transaction(async (tx) => {
    const productType = await tx.productType.findFirst({
      where: { active: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    if (!productType) throw new Error('Test DB requires at least one active ProductType.');

    const branch = await tx.branch.create({
      data: {
        name: `System Test Template Candidate ${runToken}`,
        address: 'SYSTEM TEST ONLY',
        phone: '0000000000',
        slug: branchSlug,
        businessType: 'GENERAL',
        category: {
          connectOrCreate: {
            where: { name: 'System Product Template E2E' },
            create: { name: 'System Product Template E2E', active: true, isSystem: true },
          },
        },
      },
      select: { id: true, slug: true, name: true },
    });

    const [rejectProduct, mergeProduct, promoteProduct, targetTemplateProduct] = await Promise.all([
      tx.product.create({ data: makeProductData({ name: `E2E Reject Source ${runToken}`, branchId: branch.id, productTypeId: productType.id }), select: { id: true, name: true } }),
      tx.product.create({ data: makeProductData({ name: `E2E Merge Source ${runToken}`, branchId: branch.id, productTypeId: productType.id }), select: { id: true, name: true } }),
      tx.product.create({ data: makeProductData({ name: `E2E Promote Source ${runToken}`, branchId: branch.id, productTypeId: productType.id }), select: { id: true, name: true } }),
      tx.product.create({ data: makeProductData({ name: `E2E Existing Template ${runToken}`, branchId: branch.id, productTypeId: productType.id }), select: { id: true, name: true } }),
    ]);

    const createCandidate = async (sourceProduct, purpose) => {
      const sourceSnapshot = {
        name: sourceProduct.name,
        productTypeId: productType.id,
        mode: 'STRUCTURED',
        active: true,
        noSN: true,
        trackSerialNumber: false,
        productConfig: { fixturePurpose: purpose, runToken },
      };
      const candidate = await tx.productTemplateCandidate.create({
        data: {
          sourceBranchId: branch.id,
          sourceProductId: sourceProduct.id,
          targetTemplateBranchId: branch.id,
          status: 'DRAFT',
          sourceSnapshot,
          proposedTemplateData: sourceSnapshot,
          duplicateAssessment: { fixturePurpose: purpose, deterministic: true },
          decisionNote: null,
        },
        select: { id: true, status: true, sourceProductId: true },
      });
      await tx.productTemplateCandidateEvent.create({
        data: {
          candidateId: candidate.id,
          eventType: 'CREATED',
          previousStatus: null,
          resultingStatus: 'DRAFT',
          note: `Browser E2E fixture: ${purpose}`,
          metadata: { fixturePurpose: purpose, runToken },
        },
      });
      return candidate;
    };

    const rejectCandidate = await createCandidate(rejectProduct, 'REJECT');
    const mergeCandidate = await createCandidate(mergeProduct, 'MERGE');
    const promoteCandidate = await createCandidate(promoteProduct, 'PROMOTE');

    return {
      branch,
      productType,
      rejectCandidate,
      mergeCandidate,
      promoteCandidate,
      targetTemplateProduct,
    };
  });

  const env = {
    PRODUCT_TEMPLATE_E2E_REJECT_CANDIDATE_ID: fixture.rejectCandidate.id,
    PRODUCT_TEMPLATE_E2E_MERGE_CANDIDATE_ID: fixture.mergeCandidate.id,
    PRODUCT_TEMPLATE_E2E_PROMOTE_CANDIDATE_ID: fixture.promoteCandidate.id,
    PRODUCT_TEMPLATE_E2E_TARGET_TEMPLATE_PRODUCT_ID: fixture.targetTemplateProduct.id,
    PRODUCT_TEMPLATE_E2E_FIXTURE_BRANCH_ID: fixture.branch.id,
    PRODUCT_TEMPLATE_E2E_FIXTURE_BRANCH_SLUG: fixture.branch.slug,
  };

  console.log(JSON.stringify({
    result: 'PASS',
    environment: 'TEST',
    fixture: {
      runToken,
      branch: fixture.branch,
      productType: fixture.productType,
      rejectCandidate: fixture.rejectCandidate,
      mergeCandidate: fixture.mergeCandidate,
      promoteCandidate: fixture.promoteCandidate,
      targetTemplateProduct: fixture.targetTemplateProduct,
    },
    powershell: Object.entries(env).map(([key, value]) => `$env:${key} = "${value}"`),
    retainedTestData: true,
    safety: 'Fresh Test-DB-only candidates are created for each terminal browser path.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
