const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const evidencePolicy = read(
  'src/modules/repair/intake-evidence/intakeEvidencePolicy.js'
);
const workflowRepository = read(
  'src/modules/repair/workflow/commands/transitionRepairWorkflowRepository.js'
);
const workflowService = read(
  'src/modules/repair/workflow/commands/transitionRepairWorkflowService.js'
);
const workflowController = read(
  'src/modules/repair/workflow/http/transitionRepairWorkflowController.js'
);

assert(
  evidencePolicy.includes('evaluateIntakeCompletion'),
  'Intake evidence must publish a canonical completion evaluator'
);
assert(
  evidencePolicy.includes("missingRequirements.push('CUSTOMER_CONSENT')"),
  'Completion must require customer consent'
);
assert(
  evidencePolicy.includes('conditionPhotoRequired: false') &&
    !evidencePolicy.includes("missingRequirements.push('INTAKE_CONDITION_PHOTO')"),
  'Intake condition photos must remain optional for business-neutral intake'
);
assert(
  evidencePolicy.includes('completion: evaluateIntakeCompletion(intake)'),
  'Evidence response must expose server-owned completion state'
);

assert(
  workflowRepository.includes('deviceIntake:'),
  'Workflow repository must load the linked device intake'
);
assert(
  workflowRepository.includes('consent: true'),
  'Workflow repository must load intake consent'
);
assert(
  workflowRepository.includes('photos:'),
  'Workflow repository must load intake photos'
);

assert(
  workflowService.includes('assertIntakeCompleteForEntry'),
  'Workflow service must gate the repair entry boundary'
);
assert(
  workflowService.includes('REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS'),
  'Only the diagnosis queue action should invoke the intake gate'
);
assert(
  workflowService.includes("'REPAIR_INTAKE_INCOMPLETE'"),
  'Incomplete intake must use a stable conflict code'
);
assert(
  workflowController.includes('REPAIR_INTAKE_INCOMPLETE: 409'),
  'Incomplete intake must map to HTTP 409'
);

console.log('Repair intake completion authority integration contract: PASS');
