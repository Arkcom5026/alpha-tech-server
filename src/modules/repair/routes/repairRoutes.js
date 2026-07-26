const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const repairController = require('../controllers/repairController');
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
  loadRepairEmployeeContext,
  allowRepairRoles,
} = require('../middlewares/repairAuthorization');

const router = express.Router();

const READ_AND_INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];
const OPERATION_ROLES = ['OWNER', 'MANAGER'];

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
  repairController.listWarrantyClaims
);

router.get(
  '/warranty-claims/:claimId',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  repairController.getWarrantyClaim
);

router.patch(
  '/warranty-claims/:claimId/status',
  allowRepairRoles(...OPERATION_ROLES),
  repairController.updateWarrantyClaimStatus
);

module.exports = router;
