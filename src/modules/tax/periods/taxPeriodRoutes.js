const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('./taxPeriodController');
const accountingOfficeController = require('../accountingOffice/accountingOfficePackageController');

const router = express.Router();
router.use(verifyToken);

router.get('/periods', controller.listPeriods);
router.get('/periods/summary', controller.getPeriodSummary);
router.get('/periods/:taxPeriodId', controller.getPeriodDetail);
router.get('/accounting-office/packages/:taxPeriodId', accountingOfficeController.getPackage);
router.post('/periods/ensure', controller.ensureMonthlyPeriod);
router.post('/periods/:taxPeriodId/close', controller.closePeriod);
router.post('/periods/:taxPeriodId/lock', controller.lockPeriod);
router.post('/periods/:taxPeriodId/submit', controller.submitPeriod);
router.post('/periods/:taxPeriodId/reopen', controller.reopenPeriod);

module.exports = router;