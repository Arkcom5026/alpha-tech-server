const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read('src/modules/repair/query/control-center/repairControlCenterPolicy.js');
const repository = read('src/modules/repair/query/list-jobs/listRepairJobsRepository.js');
const service = read('src/modules/repair/query/list-jobs/listRepairJobsService.js');

assert(policy.includes('SLA_HOURS_BY_STATUS'), 'SLA policy must define status thresholds');
assert(policy.includes("RECEIVED: 4"), 'Received SLA must be explicit');
assert(policy.includes("IN_PROGRESS: 24"), 'In-progress SLA must be explicit');
assert(policy.includes("WAITING_PARTS: 72"), 'Waiting-parts SLA must be explicit');
assert(policy.includes("'UNASSIGNED_TECHNICIAN'"), 'Unassigned exception must exist');
assert(policy.includes("'INTAKE_INCOMPLETE'"), 'Incomplete intake exception must exist');
assert(policy.includes("'WAITING_CUSTOMER_APPROVAL'"), 'Customer approval exception must exist');
assert(policy.includes("'WAITING_CUSTOMER_PICKUP'"), 'Customer pickup exception must exist');
assert(policy.includes("'SLA_OVERDUE'"), 'SLA overdue exception must exist');
assert(policy.includes('summarizeRepairOperations'), 'Control-center summary must exist');

assert(repository.includes('deviceIntakes:'), 'List projection must load intake evidence');
assert(repository.includes('repairDeliveries:'), 'List projection must load delivery evidence');
assert(service.includes('projectRepairOperationalState(job)'), 'Jobs must receive server operational projection');
assert(service.includes('summary: summarizeRepairOperations(items)'), 'Response must include control-center summary');
assert(service.includes('return {\n      items,'), 'List response must be an items plus summary envelope');

console.log('Repair control center SLA contract: PASS');
