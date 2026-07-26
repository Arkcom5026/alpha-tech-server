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
router.get('/jobs/:id/completion-readiness', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getCompletionReadiness);
router.put('/jobs/:id/completion-checklist', allowRepairRoles(...OPERATION_ROLES), repairController.recordCompletionChecklist);
router.get('/jobs/:id/repair-warranties', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listRepairWarranties);
router.post('/jobs/:id/repair-warranties', allowRepairRoles(...OPERATION_ROLES), repairController.issueRepairWarranty);

router.get('/jobs/:id/diagnoses', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listDiagnoses);
router.post('/jobs/:id/diagnoses', allowRepairRoles(...OPERATION_ROLES), repairController.recordDiagnosis);

router.get('/jobs/:id/estimates', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listEstimates);
router.post('/jobs/:id/estimates', allowRepairRoles(...OPERATION_ROLES), repairController.createEstimate);
router.patch('/jobs/:id/estimates/:estimateId/decision', allowRepairRoles(...OPERATION_ROLES), repairController.decideEstimate);
router.get('/jobs/:id/financial-summary', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getFinancialSummary);
router.get('/jobs/:id/settlement', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getSettlement);
router.post('/jobs/:id/payments', allowRepairRoles(...OPERATION_ROLES), repairController.recordPayment);
router.get('/jobs/:id/invoices', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listInvoices);
router.post('/jobs/:id/invoices', allowRepairRoles(...OPERATION_ROLES), repairController.issueInvoice);

router.post('/jobs/:id/handover', allowRepairRoles(...OPERATION_ROLES), repairController.handoverToCustomer);
router.get('/jobs/:id/parts/summary', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getPartUsageSummary);
router.post('/jobs/:id/parts', allowRepairRoles(...OPERATION_ROLES), repairController.addParts);
router.post('/jobs/:id/parts/:partItemId/reversal', allowRepairRoles(...OPERATION_ROLES), repairController.reversePartUsage);
router.post('/jobs/:id/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.openWarrantyClaim);
router.get('/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listWarrantyClaims);
router.get('/warranty-claims/:claimId', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getWarrantyClaim);
router.patch('/warranty-claims/:claimId/status', allowRepairRoles(...OPERATION_ROLES), repairController.updateWarrantyClaimStatus);

module.exports = router;
