/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

let failed = false;
const pass = (label) => console.log(`PASS: ${label}`);
const fail = (label) => {
  failed = true;
  console.error(`FAIL: ${label}`);
};
const assertContains = (source, value, label) => {
  if (source.includes(value)) pass(label);
  else fail(`${label} is missing`);
};
const assertNotContains = (source, value, label) => {
  if (source.includes(value)) fail(`${label} is present`);
  else pass(label);
};

const syntaxFiles = [
  'src/modules/repair/index.js',
  'src/modules/repair/routes/repairRoutes.js',
  'src/modules/repair/create/createRepairJobService.js',
  'src/modules/repair/external-intake/createExternalDeviceIntakeService.js',
  'src/modules/repair/workflow/policies/repairWorkflowPolicy.js',
  'src/modules/repair/workflow/commands/transitionRepairWorkflowRepository.js',
  'src/modules/repair/workflow/commands/transitionRepairWorkflowService.js',
  'src/modules/repair/workflow/events/repairWorkflowEventStore.js',
  'src/modules/repair/estimate-approval/repairEstimateApprovalService.js',
  'src/modules/repair/parts/addRepairPartService.js',
  'src/modules/repair/claim/open/openWarrantyClaimService.js',
  'src/modules/repair/claim/status/updateWarrantyClaimStatusService.js',
  'src/modules/repair/subcontract/repairSubcontractRepository.js',
  'src/modules/repair/subcontract/repairSubcontractService.js',
  'src/modules/repair/subcontract/repairSubcontractController.js',
  'src/modules/repair/handover/repairHandoverService.js',
  'src/modules/repair/customer-access/repairTrackingAccessService.js',
];

for (const relativePath of syntaxFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, relativePath)], { stdio: 'pipe' });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

const server = read('server.js');
assertContains(server, "require('./src/modules/repair/routes/repairRoutes')", 'repair route import');
assertContains(server, "app.use('/api/repairs', repairRoutes)", 'canonical repair route mount');
assertContains(server, "app.use('/api/repair', repairRoutes)", 'repair backward-compatible route mount');

const repairIndex = read('src/modules/repair/index.js');
assertContains(repairIndex, "require('./routes/repairRoutes')", 'repair module route export');
assertContains(repairIndex, "require('./contracts')", 'repair contract export');

const routes = read('src/modules/repair/routes/repairRoutes.js');
assertContains(routes, "'/public/tracking/:token'", 'public repair tracking endpoint');
assertContains(routes, 'router.use(verifyToken)', 'repair staff authentication guard');
assertContains(routes, 'router.use(loadRepairEmployeeContext)', 'repair employee context authority');
assertContains(routes, 'allowRepairCapabilities', 'repair capability authorization authority');
assertContains(routes, 'REPAIR_CAPABILITY', 'repair capability route declarations');
assertNotContains(routes, 'READ_AND_INTAKE_ROLES', 'legacy broad repair read/intake role group');
assertNotContains(routes, 'OPERATION_ROLES', 'legacy broad repair operation role group');
assertContains(routes, "'/intakes/external-device'", 'external device intake endpoint');
assertContains(routes, "'/jobs'", 'repair job endpoint');
assertContains(routes, "'/jobs/:id/workflow/commands'", 'repair workflow command endpoint');
assertContains(routes, "'/jobs/:id/parts'", 'repair parts endpoint');
assertContains(routes, "'/jobs/:id/estimate-approval'", 'repair estimate approval endpoint');
assertContains(routes, "'/jobs/:id/subcontracts'", 'repair subcontract context and send endpoint');
assertContains(routes, "'/jobs/:id/subcontracts/:subcontractId'", 'repair subcontract update endpoint');
assertContains(routes, "'/jobs/:id/subcontracts/:subcontractId/commands'", 'repair subcontract command endpoint');
assertContains(routes, "'/jobs/:id/warranty-claims'", 'warranty claim opening endpoint');
assertContains(routes, "'/warranty-claims/:claimId/status'", 'warranty claim lifecycle endpoint');
assertContains(routes, "'/jobs/:id/handover/finalize'", 'repair handover endpoint');
assertContains(routes, "'/jobs/:id/intake-evidence'", 'repair intake evidence endpoint');
assertNotContains(routes, "require('../../../controllers/repair", 'legacy repair controller ownership');

const authorization = read('src/modules/repair/middlewares/repairAuthorization.js');
assertContains(authorization, "READ: 'repair.read'", 'repair read capability');
assertContains(authorization, "INTAKE: 'repair.intake'", 'repair intake capability');
assertContains(authorization, "WORKFLOW: 'repair.workflow'", 'repair workflow capability');
assertContains(authorization, "PARTS: 'repair.parts'", 'repair parts capability');
assertContains(authorization, "ESTIMATE: 'repair.estimate'", 'repair estimate capability');
assertContains(authorization, "CLAIM: 'repair.claim'", 'repair claim capability');
assertContains(authorization, "HANDOVER: 'repair.handover'", 'repair handover capability');
assertContains(authorization, "CUSTOMER_ACCESS: 'repair.customer-access'", 'repair customer access capability');
assertContains(authorization, 'REPAIR_CAPABILITIES_BY_ROLE', 'repair role-to-capability matrix');
assertContains(authorization, 'allowRepairCapabilities', 'repair capability middleware');
assertContains(authorization, 'missingCapabilities', 'repair missing capability evidence');

const workflowPolicy = read('src/modules/repair/workflow/policies/repairWorkflowPolicy.js');
assertContains(workflowPolicy, "RECEIVED: 'RECEIVED'", 'repair received workflow state');
assertContains(workflowPolicy, "WAITING_DIAGNOSIS: 'WAITING_DIAGNOSIS'", 'repair diagnosis queue state');
assertContains(workflowPolicy, "WAITING_APPROVAL: 'WAITING_APPROVAL'", 'repair estimate approval state');
assertContains(workflowPolicy, "WAITING_PARTS: 'WAITING_PARTS'", 'repair waiting parts state');
assertContains(workflowPolicy, "WAITING_QC: 'WAITING_QC'", 'repair quality-control state');
assertContains(workflowPolicy, "READY_FOR_DELIVERY: 'READY_FOR_DELIVERY'", 'repair delivery readiness state');
assertContains(workflowPolicy, "CLOSED: 'CLOSED'", 'repair closed state');
assertContains(workflowPolicy, 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED', 'repair forbidden transition contract');
assertContains(workflowPolicy, 'projectLegacyServiceStatus', 'legacy repair status projection');
assertContains(workflowPolicy, 'PASSPORT_EVENT_BY_ACTION', 'device passport event projection');

const workflowService = read('src/modules/repair/workflow/commands/transitionRepairWorkflowService.js');
assertContains(workflowService, 'this.repository.transaction', 'repair workflow transaction authority');
assertContains(workflowService, 'repairJob.branchId !== branchId', 'repair branch ownership guard');
assertContains(workflowService, "const hasRepairWorkflowAuthority = typeof repo.publishWorkflowEvent === 'function';", 'repair-owned workflow authority availability');
assertContains(workflowService, 'if (!hasRepairWorkflowAuthority && (!repairJob.deviceId || !repairJob.device))', 'repair legacy fail-closed fallback when workflow authority is unavailable');
assertContains(workflowService, 'REPAIR_WORKFLOW_VERSION_CONFLICT', 'repair optimistic workflow guard');
assertContains(workflowService, 'assertRepairNotHeldByActiveSubcontract', 'repair subcontract workflow hold');
assertContains(workflowService, 'resolveRepairWorkflowTransition', 'repair transition policy authority');
assertContains(workflowService, 'publishWorkflowEvent', 'repair-owned workflow event publication');
assertContains(workflowService, 'if (repairJob.deviceId && repairJob.device', 'repair optional device passport projection');
assertContains(workflowService, 'publishPassportEvent', 'repair device passport publication');
assertContains(workflowService, "sourceType: 'REPAIR_JOB'", 'repair passport source identity');
assertContains(workflowService, 'const eventKey = `repair-workflow:${repairJobId}:${commandKey}`', 'repair workflow idempotency key');
assertContains(workflowService, 'workflowTargetStatus', 'repair workflow event projection');

const workflowEventStore = read('src/modules/repair/workflow/events/repairWorkflowEventStore.js');
assertContains(workflowEventStore, '"RepairWorkflowEvent"', 'repair workflow event authority');
assertContains(workflowEventStore, '"eventKey"', 'repair workflow durable idempotency key');
assertContains(workflowEventStore, '"targetStatus"', 'repair workflow durable status projection');

const subcontractService = read('src/modules/repair/subcontract/repairSubcontractService.js');
assertContains(subcontractService, 'allowOutsourceRepair', 'repair subcontract customer consent gate');
assertContains(subcontractService, "['APPROVED', 'REPAIRING']", 'repair subcontract workflow eligibility');
assertContains(subcontractService, 'customerEstimateAmount', 'repair subcontract rough customer price snapshot');
assertContains(subcontractService, 'customerApprovalNote', 'repair subcontract flexible customer agreement note');
assertContains(subcontractService, 'providerQuotedAmount', 'repair subcontract provider quote projection');
assertContains(subcontractService, "action === 'REQUEST_RETURN'", 'repair subcontract return request command');
assertContains(subcontractService, "action === 'RECEIVE_RETURN'", 'repair subcontract physical return command');
assertNotContains(subcontractService, 'EXACT_PRICE', 'repair subcontract hard exact-price mode');
assertNotContains(subcontractService, 'MAX_BUDGET', 'repair subcontract hard max-budget mode');

const repairContract = read('src/modules/repair/contracts/repairContract.js');
assertContains(repairContract, 'REPAIR_ACTIVE_STATUSES', 'repair active status contract');
assertContains(repairContract, 'REPAIR_TERMINAL_STATUSES', 'repair terminal status contract');
assertContains(repairContract, 'CLAIM_ACTIVE_STATUSES', 'warranty claim active status contract');
assertContains(repairContract, 'CLAIM_TERMINAL_STATUSES', 'warranty claim terminal status contract');
assertContains(repairContract, 'WARRANTY_CLAIM_RESOLUTIONS', 'warranty claim resolution contract');

const claimPolicy = read('src/modules/repair/policies/warrantyClaimPolicy.js');
assertContains(claimPolicy, 'assertRepairCanOpenClaim', 'warranty claim repair eligibility policy');
assertContains(claimPolicy, 'hasStockIdentity', 'warranty stock identity authority');
assertContains(claimPolicy, 'hasDeviceIdentity', 'warranty device identity authority');
assertContains(claimPolicy, 'assertNoActiveClaimForJob', 'single active warranty claim policy');
assertContains(claimPolicy, 'assertResolutionRequirements', 'warranty resolution policy');
assertContains(claimPolicy, "update.resolution === 'REPLACED'", 'warranty replacement authority');
assertContains(claimPolicy, "update.resolution === 'CREDITED'", 'warranty credit authority');

const packageJson = read('package.json');
assertContains(packageJson, 'run-module-tests.js', 'repair slice test discovery command');
assertContains(packageJson, '"test:certification"', 'repository certification command');

const requiredTests = [
  'src/modules/repair/create/createRepairJobSlice.test.js',
  'src/modules/repair/external-intake/createExternalDeviceIntakeSlice.test.js',
  'src/modules/repair/intake-evidence/intakeEvidencePolicy.test.js',
  'src/modules/repair/workflow/commands/transitionRepairWorkflowService.test.js',
  'src/modules/repair/workflow/policies/repairWorkflowPolicy.test.js',
  'src/modules/repair/parts/addRepairPartSlice.test.js',
  'src/modules/repair/estimate-approval/__tests__/repairEstimateApprovalPolicy.test.js',
  'src/modules/repair/claim/open/openWarrantyClaimSlice.test.js',
  'src/modules/repair/claim/status/updateWarrantyClaimStatusSlice.test.js',
  'src/modules/repair/subcontract/repairSubcontractService.test.js',
  'src/modules/repair/handover/repairHandoverPolicy.test.js',
  'src/modules/repair/customer-access/repairTrackingAccessService.test.js',
];

for (const relativePath of requiredTests) {
  if (fs.existsSync(path.join(root, relativePath))) pass(`test coverage ${relativePath}`);
  else fail(`test coverage ${relativePath} is missing`);
}

if (failed) {
  console.error('\nREPAIR CAPABILITY VERIFICATION: FAIL');
  process.exit(1);
}

console.log('\nREPAIR CAPABILITY VERIFICATION: PASS');