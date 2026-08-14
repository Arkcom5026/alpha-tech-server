const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read(
  'src/modules/repair/query/control-center/repairControlCenterPolicy.js'
);
const repository = read(
  'src/modules/repair/query/list-jobs/listRepairJobsRepository.js'
);
const service = read(
  'src/modules/repair/query/list-jobs/listRepairJobsService.js'
);

for (const status of ['RECEIVED', 'IN_PROGRESS', 'WAITING_PARTS']) {
  assert(policy.includes(`${status}:`), `Missing SLA threshold for ${status}`);
}

for (const exception of [
  'UNASSIGNED_TECHNICIAN',
  'INTAKE_INCOMPLETE',
  'WAITING_PARTS',
  'WAITING_CUSTOMER_APPROVAL',
  'WAITING_CUSTOMER_PICKUP',
  'SLA_OVERDUE',
]) {
  assert(policy.includes(exception), `Missing operational exception ${exception}`);
}

assert(
  repository.includes('deviceIntake:') &&
    repository.includes('consent: { select: { id: true } }') &&
    repository.includes('select: { category: true }'),
  'Control center repository must load the bounded singular intake completion projection'
);
assert(
  repository.includes('delivery: true'),
  'Control center repository must load singular delivery evidence'
);
assert(
  !repository.includes('deviceIntakes:') &&
    !repository.includes('repairDeliveries:'),
  'Control center repository must not use retired plural RepairJob relations'
);
assert(
  policy.includes('job?.deviceIntake') && policy.includes('!job?.delivery'),
  'Control center policy must consume singular RepairJob relations'
);
assert(
  service.includes('projectRepairOperationalState(job)'),
  'Each Repair job must receive a server-owned operational projection'
);
assert(
  service.includes('summary: summarizeRepairOperations(items)'),
  'Repair list response must publish a server-owned branch summary'
);
assert(
  service.includes('return {\n      items,\n      summary:'),
  'Repair jobs endpoint must return the control center envelope'
);

console.log('Repair control center SLA integration contract: PASS');
