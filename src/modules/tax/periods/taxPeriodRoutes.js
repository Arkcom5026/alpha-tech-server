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
const {
  TAX_VAT_SETTLEMENT_CAPABILITY,
  allowVatSettlementCapabilities,
} = require('../settlement/vatSettlementAuthorization');
const vatCarryForwardController = require('../settlement/vatCarryForwardController');
const {
  TAX_VAT_CARRY_FORWARD_CAPABILITY,
  allowVatCarryForwardCapabilities,
} = require('../settlement/vatCarryForwardAuthorization');
const withholdingTaxController = require('../withholdingTax/withholdingTaxController');
const {
  TAX_WITHHOLDING_CAPABILITY,
  allowWithholdingTaxCapabilities,
} = require('../withholdingTax/withholdingTaxAuthorization');
const unifiedTaxReadinessController = require('../readiness/unifiedTaxReadinessController');
const {
  TAX_READINESS_CAPABILITY,
  allowTaxReadinessCapabilities,
} = require('../readiness/taxReadinessAuthorization');

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
const allowTaxReadinessRead = allowTaxReadinessCapabilities(
  TAX_READINESS_CAPABILITY.READ,
);
const allowVatSettlementRead = allowVatSettlementCapabilities(
  TAX_VAT_SETTLEMENT_CAPABILITY.READ,
);
const allowVatCarryForwardRead = allowVatCarryForwardCapabilities(
  TAX_VAT_CARRY_FORWARD_CAPABILITY.READ,
);
const allowVatCarryForwardConfirm = allowVatCarryForwardCapabilities(
  TAX_VAT_CARRY_FORWARD_CAPABILITY.READ,
  TAX_VAT_CARRY_FORWARD_CAPABILITY.CONFIRM,
);
const allowWithholdingRead = allowWithholdingTaxCapabilities(
  TAX_WITHHOLDING_CAPABILITY.READ,
);
const allowWithholdingTreatment = allowWithholdingTaxCapabilities(
  TAX_WITHHOLDING_CAPABILITY.READ,
  TAX_WITHHOLDING_CAPABILITY.TREATMENT,
);
const allowWithholdingCertificateIssue = allowWithholdingTaxCapabilities(
  TAX_WITHHOLDING_CAPABILITY.READ,
  TAX_WITHHOLDING_CAPABILITY.CERTIFICATE_ISSUE,
);
const allowWithholdingFilingPrepare = allowWithholdingTaxCapabilities(
  TAX_WITHHOLDING_CAPABILITY.READ,
  TAX_WITHHOLDING_CAPABILITY.FILING_PREPARE,
);
const allowWithholdingFilingSubmit = allowWithholdingTaxCapabilities(
  TAX_WITHHOLDING_CAPABILITY.READ,
  TAX_WITHHOLDING_CAPABILITY.FILING_PREPARE,
  TAX_WITHHOLDING_CAPABILITY.FILING_SUBMIT,
);

router.get('/periods', allowTaxPeriodRead, controller.listPeriods);
router.get('/periods/summary', allowTaxPeriodRead, controller.getPeriodSummary);
router.get('/periods/:taxPeriodId', allowTaxPeriodRead, controller.getPeriodDetail);
router.get('/accounting-office/packages/:taxPeriodId', allowAccountingOfficeRead, accountingOfficeController.getPackage);
router.get('/tax-closing-handoff/:taxPeriodId', allowTaxClosingHandoffRead, taxClosingHandoffController.getBundle);
router.post('/tax-closing-handoff/:taxPeriodId/finalize', allowTaxClosingHandoffFinalize, taxClosingHandoffController.finalizeBundle);
router.get('/tax-readiness/:taxPeriodId', allowTaxReadinessRead, unifiedTaxReadinessController.getWorkspace);
router.get('/vat-settlement/:taxPeriodId', allowVatSettlementRead, vatSettlementController.getPreparation);
router.get('/vat-carry-forward/:taxPeriodId', allowVatCarryForwardRead, vatCarryForwardController.getAuthority);
router.post('/vat-carry-forward/:taxPeriodId/confirm', allowVatCarryForwardConfirm, vatCarryForwardController.confirmAuthority);
router.get('/withholding-tax/:taxPeriodId', allowWithholdingRead, withholdingTaxController.getWorkspace);
router.post('/withholding-tax/items/:taxExpenseItemId/treatment', allowWithholdingTreatment, withholdingTaxController.transitionTreatment);
router.post('/withholding-tax/:taxPeriodId/certificates/issue', allowWithholdingCertificateIssue, withholdingTaxController.issueCertificate);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/prepare', allowWithholdingFilingPrepare, withholdingTaxController.prepareFiling);
router.post('/withholding-tax/:taxPeriodId/filings/:formType/submit', allowWithholdingFilingSubmit, withholdingTaxController.submitFiling);
router.post('/periods/ensure', allowTaxPeriodManage, controller.ensureMonthlyPeriod);
router.post('/periods/:taxPeriodId/close', allowTaxPeriodManage, controller.closePeriod);
router.post('/periods/:taxPeriodId/lock', allowTaxPeriodManage, controller.lockPeriod);
router.post('/periods/:taxPeriodId/submit', allowTaxPeriodManage, controller.submitPeriod);
router.post('/periods/:taxPeriodId/reopen', allowTaxPeriodReopen, controller.reopenPeriod);

module.exports = router;
