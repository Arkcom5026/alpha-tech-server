const { resolveRepairActor } = require('../utils/repairActor');
const addRepairPartService = require('./addRepairPartService');

async function addRepairPart(req, res, next) {
  try {
    const actor = resolveRepairActor(req.user);
    const data = await addRepairPartService.execute(actor, req.params.id, req.body);
    res.status(201).json({
      success: true,
      message: 'เบิกอะไหล่สำหรับงานซ่อมเรียบร้อยแล้ว',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { addRepairPart };
