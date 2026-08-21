const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxPeriodController');
const {
  TAX_PERIOD_CAPABILITY,
  allowTaxPeriodCapabilities,
} = require('./taxPeriodAuthorization');
const accountingOfficeController = require('../accountingOffice/accountingOfficePackageController');
const {
  TAX_ACCOUNTING_OFFICE_CAPABILITY,
  allowAccountingOfficeCapabilities,
} = require('../accountingOffice/accountingOfficeAuthorization');
const taxClosingHandoffController = require('../handoff/taxClosingHandoffController');
const {
  TAX_CLOSING_HANDOFF_CAPABILITY,
  allowTaxClosingHandoffCapabilities,
} = require('../handoff/taxClosingHandoffAuthorization');
const vatSettlementController = require('../settlement/vatSettlementController');
const vatCarryForwardController = require('../settlement/vatCarryForwardController');
const withholdingTaxController = require('../withholdingTax/withholdingTaxController');
const unifiedTaxReadinessController = require('../readiness/unifiedTaxReadinessController');

const router = express.Router();
router.use(verifyToken);

const allowTaxPeriodRead = allowTaxPeriodCapabilities(TAX_PERIOD_CAPABILITY.READ);
const allowTaxPeriodManage = allowTaxPeriodCapabilities(TAX_PERIOD_CAPABILITY.MANAGE);
const allowTaxPeriodReopen = allowTaxPeriodCapabilities(
  TAX_PERIOD_CAPABILITY.MANAGE,
  TAX_PERIOD_CAPABILITY.REOPEN,
);
const allowAccountingOfficeRead = allowAccountingOfficeCapabilities(
  TAX_ACCOUNTING_OFFICE_CAPABILITY.READ,
);
const allowTaxClosingHandoffRead = allowTaxClosingHandoffCapabilities(
  TAX_CLOSING_HANDOFF_CAPABILITY.READ,
);
const allowTaxClosingHandoffFinalize = allowTaxClosingHandoffCapabilities(
  TAX_CLOSING_HANDOFF_CAPABILITY.READ,
  TAX_CLOSING_HANDOFF_CAPABILITY.FINALIZE,
);

router.get('/periods', allowTaxPeriodRead, controller.listPeriods);
router.get('/periods/summary', allowTaxPeriodRead, controller.getPeriodSummary);
router.get('/periods/:taxPeriodId', allowTaxPeriodRead, controller.getPeriodDetail);
router.get('/accounting-office/packages/:taxPeriodId', allowAccountingOfficeRead, accountingOfficeController.getPackage);
router.get('/tax-closing-handoff/:taxPeriodId', allowTaxClosingHandoffRead, taxClosingHandoffController.getBundle);
router.post('/tax-closing-handoff/:taxPeriodId/finalize', allowTaxClosingHandoffFinalize, taxClosingHandoffController.finalizeBundle);
router.get('/tax-readiness/:taxPeriodId', unifiedTaxReadinessController.getWorkspace);
router.get('/vat-settlement/:taxPeriodId', vatSettlementController.getPreparation);
router.get('/vat-carry-forward/:taxPeriodId', vatCarryForwardController.getAuthority);
router.post('/vat-carry-forward/:taxPeriodId/confirm', vatCarryForwardController.confirmAuthority);
router.get('/withholding-tax/:taxPeriodId', withholdingTaxController.getWorkspace);
router.post('/withholding-tax/items/:taxExpenseItemId/treatment', withholdingTaxController.transitionTreatment);
router.post('/withholding-tax/:taxPeriodId/certificates/issue', withholdingTaxController.issueCertificate);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/prepare', withholdingTaxController.prepareFiling);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/submit', withholdingTaxController.submitFiling);
router.post('/periods/ensure', allowTaxPeriodManage, controller.ensureMonthlyPeriod);
router.post('/periods/:taxPeriodId/close', allowTaxPeriodManage, controller.closePeriod);
router.post('/periods/:taxPeriodId/lock', allowTaxPeriodManage, controller.lockPeriod);
router.post('/periods/:taxPeriodId/submit', allowTaxPeriodManage, controller.submitPeriod);
router.post('/periods/:taxPeriodId/reopen', allowTaxPeriodReopen, controller.reopenPeriod);

module.exports = router;
