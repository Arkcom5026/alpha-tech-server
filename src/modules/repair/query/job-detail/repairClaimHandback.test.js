const test = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveClaimContext,
  CLAIM_HANDBACK_BY_RESOLUTION,
} = require('./repairJobDetailService');
const { findActiveLinkedClaim } = require('../../policies/claimRepairHoldPolicy');

test('active linked claim holds repair runtime', () => {
  const job = {
    warrantyClaims: [
      { id: 41, claimNo: 'WC-41', status: 'REPAIRING', openedAt: new Date('2026-08-10T08:00:00Z') },
    ],
  };
  const context = deriveClaimContext(job, { occurredAt: new Date('2026-08-10T07:00:00Z') });
  assert.equal(context.active, true);
  assert.equal(context.claimId, 41);
  assert.equal(context.status, 'REPAIRING');
  assert.equal(context.handbackPending, false);
  assert.equal(findActiveLinkedClaim(job).id, 41);
});

test('resolved claim newer than repair workflow projects handback pending', () => {
  const job = {
    warrantyClaims: [
      {
        id: 42,
        claimNo: 'WC-42',
        status: 'RESOLVED',
        resolution: 'REPLACED',
        resolvedAt: new Date('2026-08-10T09:00:00Z'),
      },
    ],
  };
  const context = deriveClaimContext(job, { occurredAt: new Date('2026-08-10T08:00:00Z') });
  assert.equal(context.active, false);
  assert.equal(context.handbackPending, true);
  assert.equal(context.resolution, 'REPLACED');
  assert.match(CLAIM_HANDBACK_BY_RESOLUTION.REPLACED, /สินค้าทดแทน/);
});

test('repair workflow activity after claim resolution acknowledges handback', () => {
  const job = {
    warrantyClaims: [
      {
        id: 43,
        claimNo: 'WC-43',
        status: 'RESOLVED',
        resolution: 'REPAIRED',
        resolvedAt: new Date('2026-08-10T09:00:00Z'),
      },
    ],
  };
  const context = deriveClaimContext(job, { occurredAt: new Date('2026-08-10T10:00:00Z') });
  assert.equal(context.handbackPending, false);
});
