const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxPeriodController');
const accountingOfficeController = require('../accountingOffice/accountingOfficePackageController');
const taxClosingHandoffController = require('../handoff/taxClosingHandoffController');
const vatSettlementController = require('../settlement/vatSettlementController');
const vatCarryForwardController = require('../settlement/vatCarryForwardController');
const withholdingTaxController = require('../withholdingTax/withholdingTaxController');
const unifiedTaxReadinessController = require('../readiness/unifiedTaxReadinessController');

const router = express.Router();
router.use(verifyToken);

router.get('/periods', controller.listPeriods);
router.get('/periods/summary', controller.getPeriodSummary);
router.get('/periods/:taxPeriodId', controller.getPeriodDetail);
router.get('/accounting-office/packages/:taxPeriodId', accountingOfficeController.getPackage);
router.get('/tax-closing-handoff/:taxPeriodId', taxClosingHandoffController.getBundle);
router.get('/tax-readiness/:taxPeriodId', unifiedTaxReadinessController.getWorkspace);
router.get('/vat-settlement/:taxPeriodId', vatSettlementController.getPreparation);
router.get('/vat-carry-forward/:taxPeriodId', vatCarryForwardController.getAuthority);
router.post('/vat-carry-forward/:taxPeriodId/confirm', vatCarryForwardController.confirmAuthority);
router.get('/withholding-tax/:taxPeriodId', withholdingTaxController.getWorkspace);
router.post('/withholding-tax/items/:taxExpenseItemId/treatment', withholdingTaxController.transitionTreatment);
router.post('/withholding-tax/:taxPeriodId/certificates/issue', withholdingTaxController.issueCertificate);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/prepare', withholdingTaxController.prepareFiling);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/submit', withholdingTaxController.submitFiling);
router.post('/periods/ensure', controller.ensureMonthlyPeriod);
router.post('/periods/:taxPeriodId/close', controller.closePeriod);
router.post('/periods/:taxPeriodId/lock', controller.lockPeriod);
router.post('/periods/:taxPeriodId/submit', controller.submitPeriod);
router.post('/periods/:taxPeriodId/reopen', controller.reopenPeriod);

module.exports = router;