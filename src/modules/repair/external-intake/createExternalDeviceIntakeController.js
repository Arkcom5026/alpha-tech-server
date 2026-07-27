const service = require('./createExternalDeviceIntakeService');
const { resolveRepairActor } = require('../utils/repairActor');

async function createExternalDeviceIntake(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await service.execute(actor, req.body);

    return res.status(201).json({
      success: true,
      message: 'รับอุปกรณ์ภายนอกและเปิดใบรับซ่อมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createExternalDeviceIntake };
