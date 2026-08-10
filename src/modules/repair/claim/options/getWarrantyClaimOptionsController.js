const service = require('./getWarrantyClaimOptionsService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function getWarrantyClaimOptions(req, res, next) {
  try {
    const data = await service.execute(resolveRepairActor(req.user), req.params.id);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getWarrantyClaimOptions };
