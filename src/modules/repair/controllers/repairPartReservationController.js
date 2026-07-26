const repairPartReservationService = require('../services/repairPartReservationService');
const { resolveRepairActor } = require('../utils/repairActor');

class RepairPartReservationController {
  async list(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairPartReservationService.listForRepairJob(
        actor,
        req.params.id
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async reserve(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairPartReservationService.reserve(
        actor,
        req.params.id,
        req.body
      );
      res.status(201).json({
        success: true,
        message: 'จองอะไหล่สำหรับงานซ่อมเรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  async resolve(req, res, next) {
    try {
      const actor = resolveRepairActor(req.user);
      const data = await repairPartReservationService.resolve(
        actor,
        req.params.id,
        req.params.reservationId,
        req.body
      );
      const messages = {
        INSTALLED: 'ติดตั้งอะไหล่ที่จองไว้เรียบร้อยแล้ว',
        RELEASE: 'คืนอะไหล่ที่จองไว้เข้าสู่สต็อกเรียบร้อยแล้ว',
        LOST: 'บันทึกอะไหล่ที่จองว่าสูญหายแล้ว',
        DAMAGED: 'บันทึกอะไหล่ที่จองว่าเสียหายแล้ว',
      };
      res.status(200).json({
        success: true,
        message: messages[data.status] || 'อัปเดตรายการจองอะไหล่เรียบร้อยแล้ว',
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepairPartReservationController();
module.exports.RepairPartReservationController = RepairPartReservationController;
