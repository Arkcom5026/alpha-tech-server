const createRepairJobService = require('./createRepairJobService');
const { resolveRepairActor } = require('../utils/repairActor');

async function createRepairJob(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await createRepairJobService.execute(actor, req.body);

    res.status(201).json({
      success: true,
      message: 'เปิดใบรับซ่อมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createRepairJob };
