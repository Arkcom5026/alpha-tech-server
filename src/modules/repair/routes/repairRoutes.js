const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const {
  getIntakeContext,
} = require('../query/intake-context/intakeContextController');
const {
  searchIntake,
} = require('../query/intake-search/intakeSearchController');
const {
  listCustomerWarrantyAssets,
} = require('../query/customer-warranty-assets/customerWarrantyAssetsController');
const {
  listRepairJobs,
} = require('../query/list-jobs/listRepairJobsController');
const {
  getRepairJobDetail,
} = require('../query/job-detail/repairJobDetailController');
const {
  createRepairJob,
} = require('../create/createRepairJobController');
const {
  createExternalDeviceIntake,
} = require('../external-intake/createExternalDeviceIntakeController');
const {
  transitionRepairWorkflow,
} = require('../workflow/http/transitionRepairWorkflowController');
const {
  addRepairPart,
} = require('../parts/addRepairPartController');
const {
  getRepairPartStockOptions,
} = require('../parts/options/getRepairPartStockOptionsController');
const {
  openWarrantyClaim,
} = require('../claim/open/openWarrantyClaimController');
const {
  getWarrantyClaimOptions,
} = require('../claim/options/getWarrantyClaimOptionsController');
const {
  getWarrantyReplacementOptions,
} = require('../claim/replacement/getWarrantyReplacementOptionsController');
const {
  listWarrantyClaims,
} = require('../claim/query/list/listWarrantyClaimsController');
const {
  getWarrantyClaim,
} = require('../claim/query/detail/getWarrantyClaimController');
const {
  updateWarrantyClaimStatus,
} = require('../claim/status/updateWarrantyClaimStatusController');
const {
  createTrackingAccess,
  rotateTrackingAccess,
  revokeTrackingAccess,
  getPublicRepairTracking,
} = require('../customer-access/repairTrackingAccessController');
const {
  publishEstimateApproval,
  getLatestEstimateApproval,
  decidePublicEstimateApproval,
} = require('../estimate-approval/repairEstimateApprovalController');
const {
  getIntakeEvidence,
  saveIntakeEvidence,
} = require('../intake-evidence/intakeEvidenceController');
const intakeEvidenceUpload = require('../intake-evidence/intakeEvidenceUpload');
const {
  confirmPublicPickup,
  getRepairHandover,
  finalizeRepairHandover,
} = require('../handover/repairHandoverController');
const {
  getRepairSubcontractContext,
  sendRepairSubcontract,
  updateRepairSubcontract,
  commandRepairSubcontract,
} = require('../subcontract/repairSubcontractController');
const {
  REPAIR_CAPABILITY,
  loadRepairEmployeeContext,
  allowRepairCapabilities,
} = require('../middlewares/repairAuthorization');

const router = express.Router();

router.get('/public/tracking/:token', getPublicRepairTracking);
router.post('/public/tracking/:token/estimate-decision', decidePublicEstimateApproval);
router.post('/public/tracking/:token/pickup-confirmation', confirmPublicPickup);

router.use(verifyToken);
router.use(loadRepairEmployeeContext);

router.get('/intake-search', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), searchIntake);
router.get('/intake-context/:lookup', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), getIntakeContext);
router.get('/customers/:customerId/warranty-assets', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), listCustomerWarrantyAssets);
router.post('/intakes/external-device', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), createExternalDeviceIntake);

router.get('/jobs', allowRepairCapabilities(REPAIR_CAPABILITY.READ), listRepairJobs);
router.get('/jobs/:id', allowRepairCapabilities(REPAIR_CAPABILITY.READ), getRepairJobDetail);
router.post('/jobs', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), createRepairJob);
router.post('/jobs/:id/tracking-access', allowRepairCapabilities(REPAIR_CAPABILITY.CUSTOMER_ACCESS), createTrackingAccess);
router.post('/jobs/:id/tracking-access/rotate', allowRepairCapabilities(REPAIR_CAPABILITY.CUSTOMER_ACCESS), rotateTrackingAccess);
router.delete('/jobs/:id/tracking-access', allowRepairCapabilities(REPAIR_CAPABILITY.CUSTOMER_ACCESS), revokeTrackingAccess);
router.get('/jobs/:id/estimate-approval', allowRepairCapabilities(REPAIR_CAPABILITY.ESTIMATE), getLatestEstimateApproval);
router.post('/jobs/:id/estimate-approval', allowRepairCapabilities(REPAIR_CAPABILITY.ESTIMATE), publishEstimateApproval);
router.get('/jobs/:id/handover', allowRepairCapabilities(REPAIR_CAPABILITY.READ), getRepairHandover);
router.post('/jobs/:id/handover/finalize', allowRepairCapabilities(REPAIR_CAPABILITY.HANDOVER), finalizeRepairHandover);
router.get('/jobs/:id/intake-evidence', allowRepairCapabilities(REPAIR_CAPABILITY.READ), getIntakeEvidence);
router.post('/jobs/:id/intake-evidence', allowRepairCapabilities(REPAIR_CAPABILITY.INTAKE), intakeEvidenceUpload, saveIntakeEvidence);
router.get('/jobs/:id/subcontracts', allowRepairCapabilities(REPAIR_CAPABILITY.READ), getRepairSubcontractContext);
router.post('/jobs/:id/subcontracts', allowRepairCapabilities(REPAIR_CAPABILITY.WORKFLOW), sendRepairSubcontract);
router.patch('/jobs/:id/subcontracts/:subcontractId', allowRepairCapabilities(REPAIR_CAPABILITY.WORKFLOW), updateRepairSubcontract);
router.post('/jobs/:id/subcontracts/:subcontractId/commands', allowRepairCapabilities(REPAIR_CAPABILITY.WORKFLOW), commandRepairSubcontract);

// Repair workflow commands are the only staff authority for advancing repair runtime state.
// The legacy PATCH /jobs/:id/status endpoint is intentionally not mounted because it can
// bypass diagnosis, approval, QC, claim-hold and handover workflow gates.
router.post('/jobs/:id/workflow/commands', allowRepairCapabilities(REPAIR_CAPABILITY.WORKFLOW), transitionRepairWorkflow);
router.get('/jobs/:id/part-stock-options', allowRepairCapabilities(REPAIR_CAPABILITY.PARTS), getRepairPartStockOptions);
router.post('/jobs/:id/parts', allowRepairCapabilities(REPAIR_CAPABILITY.PARTS), addRepairPart);
router.get('/jobs/:id/warranty-claim-options', allowRepairCapabilities(REPAIR_CAPABILITY.CLAIM), getWarrantyClaimOptions);
router.post('/jobs/:id/warranty-claims', allowRepairCapabilities(REPAIR_CAPABILITY.CLAIM), openWarrantyClaim);
router.get('/warranty-claims', allowRepairCapabilities(REPAIR_CAPABILITY.READ), listWarrantyClaims);
router.get('/warranty-claims/:claimId/replacement-options', allowRepairCapabilities(REPAIR_CAPABILITY.CLAIM), getWarrantyReplacementOptions);
router.get('/warranty-claims/:claimId', allowRepairCapabilities(REPAIR_CAPABILITY.READ), getWarrantyClaim);
router.patch('/warranty-claims/:claimId/status', allowRepairCapabilities(REPAIR_CAPABILITY.CLAIM), updateWarrantyClaimStatus);

module.exports = router;
