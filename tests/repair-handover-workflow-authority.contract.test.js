const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('handover finalization publishes DELIVERED into RepairWorkflowEvent authority', () => {
  const repository = read('src/modules/repair/handover/repairHandoverRepository.js');

  assert.match(repository, /publishRepairWorkflowEvent/);
  assert.match(repository, /eventType: 'DELIVERED'/);
  assert.match(repository, /action: 'DELIVER'/);
  assert.match(repository, /previousStatus: 'READY_FOR_DELIVERY'/);
  assert.match(repository, /targetStatus: 'DELIVERED'/);
  assert.match(repository, /workflowTargetStatus: 'DELIVERED'/);
});

test('device passport remains an optional projection after canonical workflow publication', () => {
  const repository = read('src/modules/repair/handover/repairHandoverRepository.js');

  const workflowPublishIndex = repository.indexOf('await publishRepairWorkflowEvent');
  const passportPublishIndex = repository.indexOf('await tx.devicePassportEvent.create');

  assert.ok(workflowPublishIndex >= 0, 'canonical RepairWorkflowEvent publication is required');
  assert.ok(passportPublishIndex > workflowPublishIndex, 'passport projection must follow canonical workflow publication');
  assert.match(repository, /if \(job\?\.deviceId\)/);
});
