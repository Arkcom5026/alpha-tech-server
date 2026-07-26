const { prisma } = require('../../../../lib/prisma');
const {
  createTaxPeriodAdministrativeService,
} = require('../application/taxPeriodAdministrativeService');

const service = createTaxPeriodAdministrativeService({ db: prisma });

const ensureMonthlyPeriod = async (req, res, next) => {
  try {
    const result = await service.ensureMonthlyPeriod(req.body);
    return res.status(result.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const ensureOperationalReadiness = async (req, res, next) => {
  try {
    const result = await service.ensureOperationalReadiness(req.body);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const listPeriods = async (req, res, next) => {
  try {
    const result = await service.listPeriods({
      branchId: req.query.branchId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      statuses: req.query.status,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  ensureMonthlyPeriod,
  ensureOperationalReadiness,
  listPeriods,
};
