const updateRepairJobStatusService = require('./updateRepairJobStatusService');
const { resolveRepairActor } = require('../../utils/repairActor');

async function updateRepairJobStatus(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await updateRepairJobStatusService.execute(
      actor,
      req.params.id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: 'อัปเดตสถานะงานซ่อมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { updateRepairJobStatus };
