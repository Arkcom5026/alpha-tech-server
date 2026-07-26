const repairWorkLogService = require('../services/repairWorkLogService');
const { resolveRepairActor } = require('../utils/repairActor');

class RepairWorkLogController {
  async list(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairWorkLogService.listForRepairJob(actor, req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async record(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairWorkLogService.record(actor, req.params.id, req.body);
      res.status(201).json({
        success: true,
        message: 'บันทึกการปฏิบัติงานของช่างเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepairWorkLogController();
module.exports.RepairWorkLogController = RepairWorkLogController;
