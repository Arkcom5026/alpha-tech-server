// src/modules/inventory/controllers/inventoryController.js
const inventoryService = require('../services/inventoryService');

class InventoryController {
  async getOnlineCatalog(req, res, next) {
    try {
      const { id: branchId, businessType } = req.tenant;
      const catalog = await inventoryService.calculateAvailableOnlineStock(branchId, businessType);

      return res.status(200).json({
        success: true,
        meta: { branchId, businessType },
        data: catalog
      });
    } catch (error) {
      next(error);
    }
  }

  async runStockAudit(req, res, next) {
    try {
      const { id: branchId } = req.tenant;
      const { id: auditorId } = req.employee;
      const { auditItems } = req.body;

      const auditResult = await inventoryService.processStockAudit(branchId, auditorId, auditItems);

      return res.status(201).json({
        success: true,
        message: 'เสร็จสิ้นการตรวจปรับรายการและปรับโครงคงคลังระบบบัญชี',
        data: auditResult
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();