// src/modules/repair/controllers/repairController.js
const repairService = require('../services/repairService');

class RepairController {
  /**
   * เปิดใบสั่งงานซ่อมใหม่
   */
  async createJob(req, res, next) {
    try {
      const { branchId } = req.user; // ดึงพิกัดสาขาจาก Token ผู้ใช้งานระบบ
      const job = await repairService.createRepairJob(Number(branchId), req.body);
      
      res.status(201).json({
        success: true,
        message: 'เปิดใบสั่งงานซ่อมเข้าสู่ระบบสาขาเรียบร้อยแล้ว',
        data: job
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * เบิกอะไหล่สต็อกเข้าเคสงานซ่อม
   */
  async addParts(req, res, next) {
    try {
      const { branchId } = req.user;
      const { id } = req.params; // ID ของ RepairJob
      const partItem = await repairService.addPartsToRepairJob(Number(branchId), Number(id), req.body);

      res.status(200).json({
        success: true,
        message: 'เบิกจ่ายอะไหล่และหักยอดคลังสินค้าสำเร็จ',
        data: partItem
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * อัปเดตสเตทและบันทึกโน้ตอาการช่าง
   */
  async updateStatus(req, res, next) {
    try {
      const { branchId } = req.user;
      const { id } = req.params;
      const updatedJob = await repairService.updateJobStatus(Number(branchId), Number(id), req.body);

      res.status(200).json({
        success: true,
        message: 'ปรับปรุงสถานะและบันทึกความคืบหน้างานซ่อมเรียบร้อย',
        data: updatedJob
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RepairController();