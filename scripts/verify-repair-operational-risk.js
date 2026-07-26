const assert = require('assert');

const {
  OPERATIONAL_RISK_CONTRACT_VERSION,
  RISK_LEVEL,
  latestOperationalAt,
  buildJobOperationalRisks,
  buildOperationalRiskProjection,
} = require('../src/modules/repair/services/repairOperationalRiskService');

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const unassigned = {
    id: 1,
    jobNo: 'RISK-001',
    customerId: 10,
    technicianId: null,
    status: 'RECEIVED',
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T02:00:00.000Z',
    warrantyClaims: [],
    metadata: {},
  };
  const waitingParts = {
    id: 2,
    jobNo: 'RISK-002',
    customerId: 11,
    technicianId: 7,
    status: 'WAITING_PARTS',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    warrantyClaims: [{ id: 20, status: 'IN_PROGRESS' }],
    metadata: {
      repeatRepairLinks: [{ repairJobId: 2, previousRepairJobId: 1 }],
    },
  };
  const healthy = {
    id: 3,
    jobNo: 'RISK-003',
    customerId: 12,
    technicianId: 8,
    status: 'IN_PROGRESS',
    createdAt: '2026-07-26T08:00:00.000Z',
    updatedAt: '2026-07-26T11:30:00.000Z',
    warrantyClaims: [],
    metadata: {},
  };

  assert.strictEqual(latestOperationalAt(unassigned), '2026-07-23T02:00:00.000Z');

  const unassignedRisks = buildJobOperationalRisks(unassigned, now);
  assert.ok(unassignedRisks.some((item) => item.code === 'UNASSIGNED_ACTIVE_JOB'));
  assert.ok(unassignedRisks.some((item) => item.code === 'STALE_OPERATIONAL_UPDATE'));
  assert.ok(unassignedRisks.some((item) => item.code === 'SLA_OVERDUE'));
  assert.ok(unassignedRisks.some((item) => item.level === RISK_LEVEL.CRITICAL));

  const partsRisks = buildJobOperationalRisks(waitingParts, now);
  assert.ok(partsRisks.some((item) => item.code === 'PARTS_DELAY_RISK'));
  assert.ok(partsRisks.some((item) => item.code === 'REPEAT_REPAIR_RISK'));
  assert.ok(partsRisks.some((item) => item.code === 'ACTIVE_WARRANTY_CLAIM_RISK'));

  assert.strictEqual(buildJobOperationalRisks(healthy, now).length, 0);

  const projection = buildOperationalRiskProjection([unassigned, waitingParts, healthy], now);
  assert.strictEqual(projection.contractVersion, OPERATIONAL_RISK_CONTRACT_VERSION);
  assert.strictEqual(projection.counters.affectedJobs, 2);
  assert.ok(projection.counters.total >= 6);
  assert.ok(projection.counters.critical > 0);
  assert.ok(projection.health.score >= 0 && projection.health.score <= 100);
  assert.strictEqual(projection.health.grade, 'AT_RISK');
  assert.ok(projection.breakdown.byCode.UNASSIGNED_ACTIVE_JOB >= 1);
  assert.ok(projection.breakdown.byStatus.RECEIVED >= 1);
  assert.strictEqual(projection.breakdown.byLevel.CRITICAL, projection.counters.critical);
  assert.strictEqual(projection.actionQueue.length, 2);
  assert.strictEqual(projection.actionQueue[0].highestLevel, RISK_LEVEL.CRITICAL);
  assert.ok(projection.actionQueue[0].riskCodes.length > 0);
  assert.ok(projection.items.every((item, index, items) => {
    if (index === 0) return true;
    const weight = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return weight[items[index - 1].level] <= weight[item.level];
  }));

  const empty = buildOperationalRiskProjection([], now);
  assert.strictEqual(empty.counters.total, 0);
  assert.strictEqual(empty.health.score, 100);
  assert.strictEqual(empty.health.grade, 'HEALTHY');
  assert.deepStrictEqual(empty.actionQueue, []);

  console.log('Repair operational risk verifier: PASS');
}

run();