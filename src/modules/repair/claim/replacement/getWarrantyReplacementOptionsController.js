const service = require('./getWarrantyReplacementOptionsService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function getWarrantyReplacementOptions(req, res, next) {
  try {
    const data = await service.execute(resolveRepairActor(req.user), req.params.claimId, req.query?.q);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getWarrantyReplacementOptions };
