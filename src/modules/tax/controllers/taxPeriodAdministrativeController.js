const { prisma } = require('../../../../lib/prisma');
const {
  createTaxPeriodAdministrativeService,
} = require('../application/taxPeriodAdministrativeService');

const service = createTaxPeriodAdministrativeService({ db: prisma });

const forwardAdministrativeError = (error, next) => {
  if (error?.name === 'TaxDocumentContractError' && !error.statusCode) {
    error.statusCode = error.code?.includes('NOT_FOUND') ? 404 : 400;
  }
  return next(error);
};

const ensureMonthlyPeriod = async (req, res, next) => {
  try {
    const result = await service.ensureMonthlyPeriod(req.body);
    return res.status(result.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return forwardAdministrativeError(error, next);
  }
};

const ensureOperationalReadiness = async (req, res, next) => {
  try {
    const result = await service.ensureOperationalReadiness(req.body);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return forwardAdministrativeError(error, next);
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
    return forwardAdministrativeError(error, next);
  }
};

module.exports = {
  ensureMonthlyPeriod,
  ensureOperationalReadiness,
  forwardAdministrativeError,
  listPeriods,
};
