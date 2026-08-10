const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxPeriodController');
const accountingOfficeController = require('../accountingOffice/accountingOfficePackageController');
const vatSettlementController = require('../settlement/vatSettlementController');
const vatCarryForwardController = require('../settlement/vatCarryForwardController');

const router = express.Router();
router.use(verifyToken);

router.get('/periods', controller.listPeriods);
router.get('/periods/summary', controller.getPeriodSummary);
router.get('/periods/:taxPeriodId', controller.getPeriodDetail);
router.get('/accounting-office/packages/:taxPeriodId', accountingOfficeController.getPackage);
router.get('/vat-settlement/:taxPeriodId', vatSettlementController.getPreparation);
router.get('/vat-carry-forward/:taxPeriodId', vatCarryForwardController.getAuthority);
router.post('/vat-carry-forward/:taxPeriodId/confirm', vatCarryForwardController.confirmAuthority);
router.post('/periods/ensure', controller.ensureMonthlyPeriod);
router.post('/periods/:taxPeriodId/close', controller.closePeriod);
router.post('/periods/:taxPeriodId/lock', controller.lockPeriod);
router.post('/periods/:taxPeriodId/submit', controller.submitPeriod);
router.post('/periods/:taxPeriodId/reopen', controller.reopenPeriod);

module.exports = router;