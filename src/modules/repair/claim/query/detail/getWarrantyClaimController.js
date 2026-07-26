const service = require('./getWarrantyClaimService');
const { resolveRepairActor } = require('../../../utils/repairActor');

async function getWarrantyClaim(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.params.claimId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { getWarrantyClaim };
