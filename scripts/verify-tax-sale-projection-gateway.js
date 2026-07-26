const assert = require('node:assert/strict');

const {
  SALE_TAX_PROJECTION_ACTIONS,
  SALE_TAX_TREATMENTS,
  createSaleTaxProjectionRuntime,
  resolveSaleTaxProjectionDecision,
} = require('../src/modules/tax');

const standardDecision = resolveSaleTaxProjectionDecision({
  sale: { id: 1, saleType: 'GOVERNMENT' },
});

assert.equal(standardDecision.action, SALE_TAX_PROJECTION_ACTIONS.PROJECT);
assert.equal(standardDecision.treatment, SALE_TAX_TREATMENTS.STANDARD);

const exemptDecision = resolveSaleTaxProjectionDecision({
  sale: {
    id: 2,
    saleType: 'GOVERNMENT',
    taxTreatment: SALE_TAX_TREATMENTS.EXEMPT,
    taxExemptionReason: 'Explicitly approved exemption',
  },
});

assert.equal(exemptDecision.action, SALE_TAX_PROJECTION_ACTIONS.SKIP);
assert.equal(exemptDecision.reason, 'Explicitly approved exemption');

assert.throws(
  () => resolveSaleTaxProjectionDecision({
    sale: {
      id: 3,
      taxTreatment: SALE_TAX_TREATMENTS.EXEMPT,
    },
  }),
  (error) => error?.code === 'SALE_TAX_EXEMPTION_REASON_REQUIRED',
);

let publishCount = 0;
const runtime = createSaleTaxProjectionRuntime({
  publisher: {
    publish: async () => {
      publishCount += 1;
      return { published: true };
    },
  },
});

(async () => {
  const result = await runtime.projectAndPublishCompletedSale({
    sale: {
      id: 4,
      branchId: 2,
      saleType: 'GOVERNMENT',
      taxTreatment: SALE_TAX_TREATMENTS.EXEMPT,
      taxExemptionReason: 'Explicitly approved exemption',
      totalAmount: 100,
      vat: 0,
    },
    commandKey: 'verify-tax-gateway',
  });

  assert.equal(result.decision.action, SALE_TAX_PROJECTION_ACTIONS.SKIP);
  assert.equal(result.draft, null);
  assert.equal(result.publication, null);
  assert.equal(publishCount, 0);

  console.log('Tax sale projection gateway contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
