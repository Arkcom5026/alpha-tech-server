const service = require('./taxPeriodService');

const normalizeRole = (value) => String(value || '').trim().toUpperCase();

const resolveBranchId = (req, source) => {
  const requestedBranchId = Number(source?.branchId);
  const accountRole = normalizeRole(req.user?.role);
  const authorityBranchId = Number(
    req.user?.branchId || req.user?.employeeBranchId || req.user?.currentBranchId || 0,
  );

  if (
    !['SUPERADMIN', 'ADMIN'].includes(accountRole) &&
    authorityBranchId > 0 &&
    requestedBranchId !== authorityBranchId
  ) {
    const error = new Error('Cannot administer another branch tax period');
    error.code = 'TAX_PERIOD_ADMINISTRATIVE_BRANCH_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  return requestedBranchId;
};

const handle = (operation) => async (req, res, next) => {
  try {
    const result = await operation(req);
    return res.status(result?.created ? 201 : 200).json({ ok: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const ensureMonthlyPeriod = handle((req) =>
  service.ensureMonthlyPeriod({
    ...req.body,
    branchId: resolveBranchId(req, req.body),
  }),
);

const listPeriods = handle((req) =>
  service.listPeriods({
    branchId: resolveBranchId(req, req.query),
    status: req.query.status,
    fromDate: req.query.fromDate,
    toDate: req.query.toDate,
  }),
);

const getPeriodSummary = handle((req) =>
  service.getPeriodSummary({
    branchId: resolveBranchId(req, req.query),
    referenceDate: req.query.referenceDate,
  }),
);

const getPeriodDetail = handle((req) =>
  service.getPeriodDetail({
    branchId: resolveBranchId(req, req.query),
    taxPeriodId: req.params.taxPeriodId,
  }),
);

const transition = (targetStatus) =>
  handle((req) =>
    service.transitionPeriod({
      branchId: resolveBranchId(req, req.body),
      taxPeriodId: req.params.taxPeriodId,
      targetStatus,
      occurredAt: req.body?.occurredAt,
    }),
  );

module.exports = {
  closePeriod: transition('CLOSED'),
  ensureMonthlyPeriod,
  getPeriodDetail,
  getPeriodSummary,
  listPeriods,
  lockPeriod: transition('LOCKED'),
  reopenPeriod: transition('REOPENED'),
  submitPeriod: transition('SUBMITTED'),
};
