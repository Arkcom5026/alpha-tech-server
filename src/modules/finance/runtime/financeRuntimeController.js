const financeRuntimeService = require('./financeRuntimeService');

const safeInt = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
};

const getBranchId = (req) => safeInt(req?.user?.branchId);

const handle = (operation) => async (req, res) => {
  try {
    const branchId = getBranchId(req);
    if (!branchId) return res.status(401).json({ message: 'unauthorized' });

    const result = await operation({
      branchId,
      query: req.query || {},
      params: req.params || {},
    });

    return res.json(result);
  } catch (error) {
    return res.status(error?.statusCode || 500).json(
      error?.payload || {
        message: 'internal_error',
        detail: String(error?.message || error),
      },
    );
  }
};

const pingFinance = handle(financeRuntimeService.pingFinance);
const getAccountsReceivableSummary = handle(financeRuntimeService.getAccountsReceivableSummary);
const getAccountsReceivableRows = handle(financeRuntimeService.getAccountsReceivableRows);
const getCustomerCreditSummary = handle(financeRuntimeService.getCustomerCreditSummary);
const getCustomerCreditRows = handle(financeRuntimeService.getCustomerCreditRows);
const getCustomerCreditByCustomerId = handle(financeRuntimeService.getCustomerCreditByCustomerId);

module.exports = {
  pingFinance,
  getAccountsReceivableSummary,
  getAccountsReceivableRows,
  getCustomerCreditSummary,
  getCustomerCreditRows,
  getCustomerCreditByCustomerId,
};
