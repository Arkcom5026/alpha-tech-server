const service = require('../service/missingCostResolutionReadService');

const toOptionalPositiveInteger = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
};

const listQueue = async (req, res, next) => {
  try {
    const result = await service.listQueue({
      branchId: req.user?.branchId,
      filters: {
        status: req.query.status,
        productId: toOptionalPositiveInteger(req.query.productId),
        stockBalanceId: toOptionalPositiveInteger(req.query.stockBalanceId),
        limit: toOptionalPositiveInteger(req.query.limit),
        offset: req.query.offset == null ? undefined : Math.max(Number(req.query.offset) || 0, 0),
      },
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const getDetail = async (req, res, next) => {
  try {
    const result = await service.getDetail({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

const getAuditHistory = async (req, res, next) => {
  try {
    const result = await service.getAuditHistory({
      branchId: req.user?.branchId,
      resolutionId: req.params.resolutionId,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listQueue,
  getDetail,
  getAuditHistory,
};
