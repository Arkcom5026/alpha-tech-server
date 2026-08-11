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

test('staff counter handover creates receiver confirmation when public confirmation was skipped', () => {
  const serviceSource = read('repairHandoverService.js');

  assert.match(serviceSource, /!delivery\?\.customerConfirmedAt && input\.receiverName/);
  assert.match(serviceSource, /repository\.confirmCustomer\(job\.id/);
  assert.match(serviceSource, /confirmationMode: input\.receiverName \? 'STAFF_COUNTER' : 'CUSTOMER_PUBLIC'/);
  assert.match(serviceSource, /contractVersion: 'repair-handover\.v3'/);
});

test('public handover confirmation remains supported alongside the counter path', () => {
  const serviceSource = read('repairHandoverService.js');

  assert.match(serviceSource, /async function confirmPublic/);
  assert.match(serviceSource, /validateCustomerConfirmation\(workflowStatus, payload\)/);
  assert.match(serviceSource, /trackingRepository\.touch\(access\.id\)/);
});
