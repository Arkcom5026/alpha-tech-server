// src/modules/finance/controllers/financeController.js
const financeService = require('../services/financeService');

class FinanceController {
  async getTaxReport(req, res, next) {
    try {
      const { id: branchId } = req.tenant;
      const { startDate, endDate } = req.query;

      const report = await financeService.generateTaxReport(branchId, startDate, endDate);

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (error) {
      next(error);
    }
  }

  async handleDeposit(req, res, next) {
    try {
      const { id: branchId } = req.tenant;
      const { customerId, amount } = req.body;

      const result = await financeService.registerCustomerDeposit(branchId, customerId, amount);

      return res.status(201).json({
        success: true,
        message: 'ทำรายการฝากเงินมัดจำล่วงหน้าเข้าบัญชีลูกค้าสำเร็จ',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FinanceController();