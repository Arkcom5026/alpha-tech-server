const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RepairHandoverRepository } = require('./repairHandoverRepository');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

test('handover repository resolves workflow event only for this repair job and branch', async () => {
  let received;
  const repository = new RepairHandoverRepository({
    devicePassportEvent: {
      findFirst(args) {
        received = args;
        return Promise.resolve(null);
      },
    },
  });

  await repository.findLatestWorkflowEvent(31, 44, 7);

  assert.deepEqual(received.where, {
    deviceId: 44,
    branchId: 7,
    sourceType: 'REPAIR_JOB',
    sourceId: '31',
  });
  assert.deepEqual(received.orderBy, [{ occurredAt: 'desc' }, { id: 'desc' }]);
});

test('handover finalization publishes DELIVERED as repair workflow authority', () => {
  const repositorySource = read('repairHandoverRepository.js');
  const serviceSource = read('repairHandoverService.js');

  assert.match(repositorySource, /sourceType: 'REPAIR_JOB'/);
  assert.match(repositorySource, /workflowPreviousStatus: 'READY_FOR_DELIVERY'/);
  assert.match(repositorySource, /workflowTargetStatus: 'DELIVERED'/);
  assert.match(repositorySource, /action: 'DELIVER'/);
  assert.match(serviceSource, /validateFinalization\(workflowStatus, delivery, payload\)/);
  assert.match(serviceSource, /workflowStatus: 'DELIVERED'/);
});

test('handover service preserves delivered idempotency before workflow gating', () => {
  const serviceSource = read('repairHandoverService.js');
  const deliveredGuard = serviceSource.indexOf("existing?.status === 'DELIVERED'");
  const workflowLookup = serviceSource.indexOf('const workflowStatus = await workflowStatusFor(job);');

  assert.ok(deliveredGuard >= 0);
  assert.ok(workflowLookup > deliveredGuard);
});
