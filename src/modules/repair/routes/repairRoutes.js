const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const {
  getIntakeContext,
} = require('../query/intake-context/intakeContextController');
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
  updateRepairJobStatus,
} = require('../status/updateRepairJobStatusController');
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
  loadRepairEmployeeContext,
  allowRepairRoles,
} = require('../middlewares/repairAuthorization');

const router = express.Router();

const READ_AND_INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];
const OPERATION_ROLES = ['OWNER', 'MANAGER'];

// Customer-safe endpoint. It must remain before the staff authentication middleware.
router.get('/public/tracking/:token', getPublicRepairTracking);

router.use(verifyToken);
router.use(loadRepairEmployeeContext);

router.get(
  '/intake-context/:lookup',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  getIntakeContext
);

router.get(
  '/customers/:customerId/warranty-assets',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  listCustomerWarrantyAssets
);

router.get(
  '/jobs',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  listRepairJobs
);

router.get(
  '/jobs/:id',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  getRepairJobDetail
);

router.post(
  '/jobs',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  createRepairJob
);

router.post(
  '/jobs/:id/tracking-access',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  createTrackingAccess
);

router.post(
  '/jobs/:id/tracking-access/rotate',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  rotateTrackingAccess
);

router.delete(
  '/jobs/:id/tracking-access',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  revokeTrackingAccess
);

router.patch(
  '/jobs/:id/status',
  allowRepairRoles(...OPERATION_ROLES),
  updateRepairJobStatus
);

router.post(
  '/jobs/:id/parts',
  allowRepairRoles(...OPERATION_ROLES),
  addRepairPart
);

router.post(
  '/jobs/:id/warranty-claims',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  openWarrantyClaim
);

router.get(
  '/warranty-claims',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  listWarrantyClaims
);

router.get(
  '/warranty-claims/:claimId',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  getWarrantyClaim
);

router.patch(
  '/warranty-claims/:claimId/status',
  allowRepairRoles(...OPERATION_ROLES),
  updateWarrantyClaimStatus
);

module.exports = router;
