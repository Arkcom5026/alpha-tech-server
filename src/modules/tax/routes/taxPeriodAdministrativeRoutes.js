const express = require('express');
const {
  protect,
  restrictTo,
} = require('../../../middlewares/authGuard');
const controller = require('../controllers/taxPeriodAdministrativeController');

const router = express.Router();

router.use(protect, restrictTo('OWNER', 'MANAGER'));

router.get('/periods', controller.listPeriods);
router.post('/periods/ensure', controller.ensureMonthlyPeriod);
router.post('/periods/readiness', controller.ensureOperationalReadiness);

module.exports = router;
