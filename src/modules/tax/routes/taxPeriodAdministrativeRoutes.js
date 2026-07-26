const express = require('express');
const verifyToken = require('../../../../middlewares/verifyToken');
const controller = require('../controllers/taxPeriodAdministrativeController');

const router = express.Router();

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const requireTaxPeriodAdministrator = (req, res, next) => {
  const accountRole = normalizeRole(req?.user?.role);
  const employeeRole = normalizeRole(req?.user?.employeeRole);

  const allowed =
    ['SUPERADMIN', 'ADMIN'].includes(accountRole) ||
    ['OWNER', 'MANAGER'].includes(employeeRole);

  if (!allowed) {
    return res.status(403).json({
      ok: false,
      code: 'TAX_PERIOD_ADMINISTRATIVE_ACCESS_FORBIDDEN',
      error: 'Tax Period administration requires OWNER or MANAGER authority',
      reqId: req.id || null,
    });
  }

  return next();
};

router.use(verifyToken, requireTaxPeriodAdministrator);

router.get('/periods', controller.listPeriods);
router.post('/periods/ensure', controller.ensureMonthlyPeriod);
router.post('/periods/readiness', controller.ensureOperationalReadiness);

module.exports = router;
