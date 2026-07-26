const repairCustomerNotificationService = require('../services/repairCustomerNotificationService');
const { resolveRepairActor } = require('../utils/repairActor');

class RepairCustomerNotificationController {
  async get(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairCustomerNotificationService.getForRepairJob(
        actor,
        req.params.id
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async record(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairCustomerNotificationService.record(
        actor,
        req.params.id,
        req.body
      );
      res.status(201).json({
        success: true,
        message: data.readyForPickup
          ? 'บันทึกการแจ้งลูกค้าและสถานะพร้อมรับเครื่องเรียบร้อยแล้ว'
          : 'บันทึกผลการติดต่อลูกค้าเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepairCustomerNotificationController();
module.exports.RepairCustomerNotificationController = RepairCustomerNotificationController;
