const { prisma } = require('../../../../lib/prisma');
const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');
const {
  createTaxPeriodAdministrativeService,
} = require('../application/taxPeriodAdministrativeService');
const {
  createTaxPeriodLifecycleService,
} = require('../application/taxPeriodLifecycleService');
const {
  TAX_PERIOD_STATUSES,
} = require('../policies/taxPeriodLifecyclePolicy');
const {
  assertBranchScope,
  assertReadinessBranchScope,
  resolveTaxAdministratorScope,
} = require('../policies/taxPeriodAdministrativeBranchScopePolicy');

const service = createTaxPeriodAdministrativeService({ db: prisma });
const lifecycleService = createTaxPeriodLifecycleService({ db: prisma });

const CONFLICT_CODES = new Set([
  'TAX_PERIOD_BOUNDARY_OVERLAP',
  'TAX_PERIOD_CODE_CONFLICT',
  'TAX_PERIOD_CREATION_CONFLICT',
  'TAX_PERIOD_LIFECYCLE_CONFLICT',
  'TAX_PERIOD_TRANSITION_FORBIDDEN',
  'TAX_PERIOD_NOT_AVAILABLE',
]);

const NOT_FOUND_CODES = new Set([
  'TAX_PERIOD_NOT_FOUND',
  'TAX_LEDGER_ENTRY_NOT_FOUND',
]);

const FORBIDDEN_CODES = new Set([
  'TAX_PERIOD_ADMINISTRATIVE_ACCESS_FORBIDDEN',
  'TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN',
]);

const mapAdministrativeError = (error) => {
  if (!(error instanceof TaxDocumentContractError)) return error;
  if (Number.isInteger(error.statusCode)) return error;

  if (FORBIDDEN_CODES.has(error.code)) error.statusCode = 403;
  else if (NOT_FOUND_CODES.has(error.code)) error.statusCode = 404;
  else if (CONFLICT_CODES.has(error.code)) error.statusCode = 409;
  else error.statusCode = 400;

  return error;
};

const ensureMonthlyPeriod = async (req, res, next) => {
  try {
    const administrator = resolveTaxAdministratorScope(req.user);
    const branchId = assertBranchScope({
      administrator,
      branchId: req.body?.branchId,
    });
    const result = await service.ensureMonthlyPeriod({
      ...req.body,
      branchId,
    });
    return res.status(result.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(mapAdministrativeError(error));
  }
};

const ensureOperationalReadiness = async (req, res, next) => {
  try {
    const administrator = resolveTaxAdministratorScope(req.user);
    const branchIds = assertReadinessBranchScope({
      administrator,
      branchIds: req.body?.branchIds,
    });
    const result = await service.ensureOperationalReadiness({
      ...req.body,
      branchIds,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(mapAdministrativeError(error));
  }
};

const getPeriodDetail = async (req, res, next) => {
  try {
    const administrator = resolveTaxAdministratorScope(req.user);
    const branchId = assertBranchScope({
      administrator,
      branchId: req.query.branchId,
    });
    const result = await service.getPeriodDetail({
      taxPeriodId: req.params.taxPeriodId,
      branchId,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(mapAdministrativeError(error));
  }
};

const listPeriods = async (req, res, next) => {
  try {
    const administrator = resolveTaxAdministratorScope(req.user);
    const branchId = assertBranchScope({
      administrator,
      branchId: req.query.branchId,
    });
    const result = await service.listPeriods({
      branchId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      statuses: req.query.status,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(mapAdministrativeError(error));
  }
};

const transitionPeriodTo = (targetStatus) => async (req, res, next) => {
  try {
    const administrator = resolveTaxAdministratorScope(req.user);
    const branchId = assertBranchScope({
      administrator,
      branchId: req.body?.branchId,
    });
    const result = await lifecycleService.transitionPeriod({
      taxPeriodId: req.params.taxPeriodId,
      branchId,
      targetStatus,
      occurredAt: req.body?.occurredAt,
    });
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return next(mapAdministrativeError(error));
  }
};

const closePeriod = transitionPeriodTo(TAX_PERIOD_STATUSES.CLOSED);
const lockPeriod = transitionPeriodTo(TAX_PERIOD_STATUSES.LOCKED);
const submitPeriod = transitionPeriodTo(TAX_PERIOD_STATUSES.SUBMITTED);
const reopenPeriod = transitionPeriodTo(TAX_PERIOD_STATUSES.REOPENED);

module.exports = {
  closePeriod,
  ensureMonthlyPeriod,
  ensureOperationalReadiness,
  getPeriodDetail,
  listPeriods,
  lockPeriod,
  mapAdministrativeError,
  reopenPeriod,
  submitPeriod,
  transitionPeriodTo,
};
