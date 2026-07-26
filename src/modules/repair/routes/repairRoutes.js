const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const repairController = require('../controllers/repairController');
const repairWorkLogController = require('../controllers/repairWorkLogController');
const repairPartReservationController = require('../controllers/repairPartReservationController');
const repairCustomerNotificationController = require('../controllers/repairCustomerNotificationController');
const {
  loadRepairEmployeeContext,
  allowRepairRoles,
} = require('../middlewares/repairAuthorization');

const router = express.Router();

const READ_AND_INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER'];
const OPERATION_ROLES = ['OWNER', 'MANAGER'];

router.use(verifyToken);
router.use(loadRepairEmployeeContext);
router.use((req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

router.get('/intake-context/:lookup', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getIntakeContext);
router.get('/customers/:customerId/warranty-assets', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listCustomerWarrantyAssets);
router.get('/dashboard', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getOperationalDashboard);
router.get('/dashboard/risks', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getOperationalRiskDashboard);
router.get('/dashboard/decisions', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getOperationalDecisionDashboard);
router.get('/dashboard/alerts', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getManagementAlertDashboard);
router.get('/dashboard/brief', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getManagementDailyBrief);
router.get('/dashboard/executive-summary', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getExecutiveSummary);
router.get('/dashboard/suppliers', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getSupplierIntelligence);
router.get('/jobs', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listJobs);
router.get('/jobs/:id', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getJob);
router.post('/jobs', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.createJob);
router.patch('/jobs/:id/status', allowRepairRoles(...OPERATION_ROLES), repairController.updateStatus);
router.get('/jobs/:id/completion-readiness', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getCompletionReadiness);
router.put('/jobs/:id/completion-checklist', allowRepairRoles(...OPERATION_ROLES), repairController.recordCompletionChecklist);
router.get('/jobs/:id/repair-warranties', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listRepairWarranties);
router.post('/jobs/:id/repair-warranties', allowRepairRoles(...OPERATION_ROLES), repairController.issueRepairWarranty);
router.post('/jobs/:id/repeat-repair-link', allowRepairRoles(...OPERATION_ROLES), repairController.linkRepeatRepair);
router.get('/jobs/:id/asset-timeline', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getAssetTimeline);
router.get('/jobs/:id/operational-intelligence', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getOperationalIntelligence);
router.get('/jobs/:id/cost-analytics', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getCostAnalytics);
router.get('/jobs/:id/repeat-failure-analytics', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getRepeatFailureAnalytics);

router.get('/jobs/:id/diagnoses', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listDiagnoses);
router.post('/jobs/:id/diagnoses', allowRepairRoles(...OPERATION_ROLES), repairController.recordDiagnosis);

router.get('/jobs/:id/estimates', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listEstimates);
router.post('/jobs/:id/estimates', allowRepairRoles(...OPERATION_ROLES), repairController.createEstimate);
router.patch('/jobs/:id/estimates/:estimateId/decision', allowRepairRoles(...OPERATION_ROLES), repairController.decideEstimate);

router.get('/jobs/:id/work-logs', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairWorkLogController.list);
router.post('/jobs/:id/work-logs', allowRepairRoles(...OPERATION_ROLES), repairWorkLogController.record);

router.get('/jobs/:id/financial-summary', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getFinancialSummary);
router.get('/jobs/:id/settlement', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getSettlement);
router.post('/jobs/:id/payments', allowRepairRoles(...OPERATION_ROLES), repairController.recordPayment);
router.get('/jobs/:id/invoices', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listInvoices);
router.post('/jobs/:id/invoices', allowRepairRoles(...OPERATION_ROLES), repairController.issueInvoice);

router.get('/jobs/:id/customer-notifications', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairCustomerNotificationController.get);
router.post('/jobs/:id/customer-notifications', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairCustomerNotificationController.record);
router.post('/jobs/:id/handover', allowRepairRoles(...OPERATION_ROLES), repairController.handoverToCustomer);
router.get('/jobs/:id/parts/summary', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getPartUsageSummary);
router.get('/jobs/:id/parts/reservations', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairPartReservationController.list);
router.post('/jobs/:id/parts/reservations', allowRepairRoles(...OPERATION_ROLES), repairPartReservationController.reserve);
router.patch('/jobs/:id/parts/reservations/:reservationId', allowRepairRoles(...OPERATION_ROLES), repairPartReservationController.resolve);
router.post('/jobs/:id/parts', allowRepairRoles(...OPERATION_ROLES), repairController.addParts);
router.post('/jobs/:id/parts/:partItemId/reversal', allowRepairRoles(...OPERATION_ROLES), repairController.reversePartUsage);
router.post('/jobs/:id/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.openWarrantyClaim);
router.get('/warranty-claims', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.listWarrantyClaims);
router.get('/warranty-claims/:claimId', allowRepairRoles(...READ_AND_INTAKE_ROLES), repairController.getWarrantyClaim);
router.patch('/warranty-claims/:claimId/status', allowRepairRoles(...OPERATION_ROLES), repairController.updateWarrantyClaimStatus);

module.exports = router;
