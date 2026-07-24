const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const repairController = require('../controllers/repairController');
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
  repairController.getIntakeContext
);

router.get(
  '/jobs',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  repairController.listJobs
);

router.get(
  '/jobs/:id',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  repairController.getJob
);

router.post(
  '/jobs',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  repairController.createJob
);

router.patch(
  '/jobs/:id/status',
  allowRepairRoles(...OPERATION_ROLES),
  repairController.updateStatus
);

router.post(
  '/jobs/:id/parts',
  allowRepairRoles(...OPERATION_ROLES),
  repairController.addParts
);

router.post(
  '/jobs/:id/warranty-claims',
  allowRepairRoles(...READ_AND_INTAKE_ROLES),
  repairController.openWarrantyClaim
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
