const openWarrantyClaimService = require('./openWarrantyClaimService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function openWarrantyClaim(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await openWarrantyClaimService.execute(
      actor,
      req.params.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'เปิดรายการเคลมจากใบงานซ่อมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { openWarrantyClaim };
