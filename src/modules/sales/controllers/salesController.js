// src/modules/sales/controllers/salesController.js
const salesService = require('../services/salesService');

class SalesController {
  async handleCheckout(req, res, next) {
    try {
      const { id: branchId, businessType } = req.tenant;
      const { id: cashierId } = req.employee;
      const payload = req.body;

      const invoice = await salesService.checkout(branchId, cashierId, payload, businessType);

      return res.status(201).json({
        success: true,
        message: 'บันทึกการชำระเงินและประมวลลดระดับคลังสินค้าเสร็จสิ้น',
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SalesController();