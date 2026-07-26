const service = require('./updateWarrantyClaimStatusService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function updateWarrantyClaimStatus(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.params.claimId, req.body);
    res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะเคลมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateWarrantyClaimStatus,
};
