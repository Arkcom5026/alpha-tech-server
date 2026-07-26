const listWarrantyClaimsService = require('./listWarrantyClaimsService');
const { resolveRepairActor } = require('../../../utils/repairActor');

async function listWarrantyClaims(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await listWarrantyClaimsService.execute(actor, req.query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = { listWarrantyClaims };
