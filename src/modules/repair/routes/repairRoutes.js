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
  updateRepairJobStatus,
} = require('../status/updateRepairJobStatusController');
const {
  transitionRepairWorkflow,
} = require('../workflow/http/transitionRepairWorkflowController');
const {
  addRepairPart,
} = require('../parts/addRepairPartController');
const {
  openWarrantyClaim,
} = require('../claim/open/openWarrantyClaimController');
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
  REPAIR_CAPABILITY,
  loadRepairEmployeeContext,
  allowRepairCapabilities,
} = require('../middlewares/repairAuthorization');

const router = express.Router();

const can = (...capabilities) => allowRepairCapabilities(...capabilities);

// Customer-safe endpoint. It must remain before the staff authentication middleware.
router.get('/public/tracking/:token', getPublicRepairTracking);
router.post(
  '/public/tracking/:token/estimate-decision',
  decidePublicEstimateApproval
);
router.post('/public/tracking/:token/pickup-confirmation', confirmPublicPickup);

router.use(verifyToken);
router.use(loadRepairEmployeeContext);

router.get('/intake-search', can(REPAIR_CAPABILITY.INTAKE), searchIntake);
router.get('/intake-context/:lookup', can(REPAIR_CAPABILITY.INTAKE), getIntakeContext);
router.get(
  '/customers/:customerId/warranty-assets',
  can(REPAIR_CAPABILITY.INTAKE),
  listCustomerWarrantyAssets
);
router.post(
  '/intakes/external-device',
  can(REPAIR_CAPABILITY.INTAKE),
  createExternalDeviceIntake
);

router.get('/jobs', can(REPAIR_CAPABILITY.READ), listRepairJobs);
router.get('/jobs/:id', can(REPAIR_CAPABILITY.READ), getRepairJobDetail);
router.post('/jobs', can(REPAIR_CAPABILITY.INTAKE), createRepairJob);

router.post(
  '/jobs/:id/tracking-access',
  can(REPAIR_CAPABILITY.CUSTOMER_ACCESS),
  createTrackingAccess
);
router.post(
  '/jobs/:id/tracking-access/rotate',
  can(REPAIR_CAPABILITY.CUSTOMER_ACCESS),
  rotateTrackingAccess
);
router.delete(
  '/jobs/:id/tracking-access',
  can(REPAIR_CAPABILITY.CUSTOMER_ACCESS),
  revokeTrackingAccess
);

router.get(
  '/jobs/:id/estimate-approval',
  can(REPAIR_CAPABILITY.READ),
  getLatestEstimateApproval
);
router.post(
  '/jobs/:id/estimate-approval',
  can(REPAIR_CAPABILITY.ESTIMATE),
  publishEstimateApproval
);

router.get('/jobs/:id/handover', can(REPAIR_CAPABILITY.READ), getRepairHandover);
router.post(
  '/jobs/:id/handover/finalize',
  can(REPAIR_CAPABILITY.HANDOVER),
  finalizeRepairHandover
);

router.get(
  '/jobs/:id/intake-evidence',
  can(REPAIR_CAPABILITY.READ),
  getIntakeEvidence
);
router.post(
  '/jobs/:id/intake-evidence',
  can(REPAIR_CAPABILITY.INTAKE),
  intakeEvidenceUpload,
  saveIntakeEvidence
);

router.post(
  '/jobs/:id/workflow/commands',
  can(REPAIR_CAPABILITY.WORKFLOW),
  transitionRepairWorkflow
);
router.patch(
  '/jobs/:id/status',
  can(REPAIR_CAPABILITY.WORKFLOW),
  updateRepairJobStatus
);
router.post('/jobs/:id/parts', can(REPAIR_CAPABILITY.PARTS), addRepairPart);

router.post(
  '/jobs/:id/warranty-claims',
  can(REPAIR_CAPABILITY.CLAIM),
  openWarrantyClaim
);
router.get('/warranty-claims', can(REPAIR_CAPABILITY.READ), listWarrantyClaims);
router.get(
  '/warranty-claims/:claimId',
  can(REPAIR_CAPABILITY.READ),
  getWarrantyClaim
);
router.patch(
  '/warranty-claims/:claimId/status',
  can(REPAIR_CAPABILITY.CLAIM),
  updateWarrantyClaimStatus
);

module.exports = router;
