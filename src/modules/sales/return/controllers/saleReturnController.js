const { validateSaleReturnCommand } = require('../validators/saleReturnValidator');
const { SaleReturnError } = require('../contracts/saleReturnError');
const { SaleReturnFailureCode } = require('../contracts/saleReturnFailureCode');
const { mapSaleReturnError } = require('../mappers/saleReturnMapper');
const {
  loadSaleReturnEligibility,
  completeSaleReturn,
} = require('../services/saleReturnService');

const buildActorContext = (req) => ({
  branchId: Number(req.user?.branchId),
  employeeId: Number(req.user?.employeeId || req.user?.profileId),
  actorRole: String(req.user?.role || ''),
});

const sendError = (res, error) => {
  const known = error instanceof SaleReturnError;
  return res.status(known ? error.status : 500).json(
    mapSaleReturnError(known ? error : new Error('Unable to complete sale return'))
  );
};

const getSaleReturnEligibilityController = async (req, res) => {
  try {
    const { branchId } = buildActorContext(req);
    const saleId = Number(req.params.saleId);
    if (!branchId || !Number.isInteger(saleId) || saleId <= 0) {
      throw new SaleReturnError(
        400,
        SaleReturnFailureCode.INVALID_SALE_ID,
        'Branch context and valid saleId are required'
      );
    }
    return res.json(await loadSaleReturnEligibility({ saleId, branchId }));
  } catch (error) {
    return sendError(res, error);
  }
};

const completeSaleReturnController = async (req, res) => {
  try {
    const actor = buildActorContext(req);
    if (!actor.branchId || !actor.employeeId) {
      throw new SaleReturnError(
        401,
        SaleReturnFailureCode.ACTOR_REQUIRED,
        'Branch and employee context are required'
      );
    }
    const command = validateSaleReturnCommand(req.body);
    const result = await completeSaleReturn({ command, ...actor });
    return res.status(result.idempotency?.replayed ? 200 : 201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  getSaleReturnEligibilityController,
  completeSaleReturnController,
};
