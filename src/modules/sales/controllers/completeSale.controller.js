const { parseCompleteSaleCommand } = require('../contracts/completeSale.contract');
const { completeSale } = require('../services/completeSale.service');

const completeSaleController = async (req, res) => {
  try {
    const branchId = Number(req.user?.branchId);
    const employeeId = Number(req.user?.employeeId ?? req.user?.employeeProfileId);
    if (!branchId || !employeeId) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authenticated branch and employee are required' });
    }
    const command = parseCompleteSaleCommand(req.body);
    const result = await completeSale({ command, branchId, employeeId });
    return res.status(result.idempotency.replayed ? 200 : 201).json(result);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[sales.complete] failed', { code: error?.code, message: error?.message });
    return res.status(status).json({
      code: error?.code || 'SALE_COMPLETION_FAILED',
      message: error?.message || 'Unable to complete sale',
      ...(error?.details ? { details: error.details } : {}),
    });
  }
};

module.exports = { completeSaleController };
