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

router.get('/intake-context/:lookup', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getIntakeContext);
router.get('/customers/:customerId/warranty-assets', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listCustomerWarrantyAssets);
router.get('/jobs', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listJobs);
router.get('/jobs/:id', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getJob);
router.post('/jobs', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.createJob);
router.patch('/jobs/:id/status', allowRepairRoles(...OPERATION_ROLES), repairController.updateStatus);

router.get('/jobs/:id/diagnoses', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listDiagnoses);
router.post('/jobs/:id/diagnoses', allowRepairRoles(...OPERATION_ROLES), repairController.recordDiagnosis);

router.get('/jobs/:id/estimates', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listEstimates);
router.post('/jobs/:id/estimates', allowRepairRoles(...OPERATION_ROLES), repairController.createEstimate);
router.patch('/jobs/:id/estimates/:estimateId/decision', allowRepairRoles(...OPERATION_ROLES), repairController.decideEstimate);

router.post('/jobs/:id/handover', allowRepairRoles(...OPERATION_ROLES), repairController.handoverToCustomer);
router.post('/jobs/:id/parts', allowRepairRoles(...OPERATION_ROLES), repairController.addParts);
router.post('/jobs/:id/parts/:partItemId/reversal', allowRepairRoles(...OPERATION_ROLES), repairController.reversePartUsage);
router.post('/jobs/:id/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.openWarrantyClaim);
router.get('/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listWarrantyClaims);
router.get('/warranty-claims/:claimId', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getWarrantyClaim);
router.patch('/warranty-claims/:claimId/status', allowRepairRoles(...OPERATION_ROLES), repairController.updateWarrantyClaimStatus);

module.exports = router;
