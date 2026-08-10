const inputTaxReportRuntimeService = require('./inputTaxReportRuntimeService');

const safeLogContext = (req, error) => ({
  reqId: req?.id || req?.headers?.['x-request-id'] || null,
  method: req?.method || null,
  path: req?.originalUrl || req?.url || null,
  branchId: req?.user?.branchId || null,
  actorEmployeeId: req?.user?.employeeId || null,
  code: error?.code || 'INPUT_TAX_REPORT_INTERNAL_ERROR',
  errorName: error?.name || null,
});

const getInputTaxReport = async (req, res) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Surrogate-Control': 'no-store',
    });
    res.removeHeader('ETag');
    res.removeHeader('Last-Modified');

    const payload = await inputTaxReportRuntimeService.getInputTaxReport({
      user: req.user || {},
      query: req.query || {},
    });
    return res.status(200).json(payload);
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500);
    if (statusCode >= 500) console.error('[input-tax-report] FAILED', safeLogContext(req, error));
    return res.status(statusCode).json({
      message: statusCode >= 500 ? 'An error occurred while fetching the input tax report.' : error.message,
      code: error?.code || (statusCode >= 500 ? 'INPUT_TAX_REPORT_INTERNAL_ERROR' : undefined),
      ...(statusCode < 500 && error?.details ? { details: error.details } : {}),
    });
  }
};

module.exports = { getInputTaxReport, safeLogContext };
