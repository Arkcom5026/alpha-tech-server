const inputTaxReportRuntimeService = require('./inputTaxReportRuntimeService');

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
    if (statusCode >= 500) console.error('Error fetching input tax report:', error);
    return res.status(statusCode).json({
      message: statusCode >= 500 ? 'An error occurred while fetching the input tax report.' : error.message,
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.details ? { details: error.details } : {}),
      ...(statusCode >= 500 ? { error: error.message || String(error) } : {}),
    });
  }
};

module.exports = { getInputTaxReport };
