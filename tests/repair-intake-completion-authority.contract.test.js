const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const policy = read('src/modules/repair/intake-evidence/intakeEvidencePolicy.js');
const repository = read('src/modules/repair/workflow/commands/transitionRepairWorkflowRepository.js');
const service = read('src/modules/repair/workflow/commands/transitionRepairWorkflowService.js');
const controller = read('src/modules/repair/workflow/http/transitionRepairWorkflowController.js');

assert(
  policy.includes('function evaluateIntakeCompletion(intake)'),
  'Intake evidence must expose a completion evaluator'
);
assert(
  policy.includes("missingRequirements.push('CUSTOMER_CONSENT')"),
  'Completion must require customer consent'
);
assert(
  policy.includes("missingRequirements.push('INTAKE_PHOTO')"),
  'Completion must require an intake condition photo'
);
assert(
  policy.includes('completion: evaluateIntakeCompletion(intake)'),
  'Evidence projection must publish completion state'
);
assert(
  repository.includes('deviceIntake: {'),
  'Workflow repository must load the linked device intake'
);
assert(
  repository.includes('consent: true'),
  'Workflow repository must load intake consent'
);
assert(
  repository.includes('photos: {'),
  'Workflow repository must load intake photos'
);
assert(
  service.includes("if (action !== 'QUEUE_DIAGNOSIS') return;"),
  'Completion gate must target the diagnosis queue boundary'
);
assert(
  service.includes("'REPAIR_INTAKE_INCOMPLETE'"),
  'Incomplete intake must have a stable conflict code'
);
assert(
  service.indexOf('assertIntakeCompleteForAction(repairJob, action);') <
    service.indexOf('resolveRepairWorkflowTransition(workflowStatus, action)'),
  'Completion must be checked before applying the transition'
);
assert(
  controller.includes('REPAIR_INTAKE_INCOMPLETE: 409'),
  'Incomplete intake must map to HTTP 409'
);

console.log('Repair intake completion authority contract: PASS');
