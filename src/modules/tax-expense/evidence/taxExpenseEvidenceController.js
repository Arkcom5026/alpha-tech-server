'use strict';

const { branchIdFromToken, employeeIdFromToken, sendError } = require('../shared/taxExpenseContext');
const { TaxExpenseEvidenceService } = require('./taxExpenseEvidenceService');

class TaxExpenseEvidenceController {
  constructor(service = new TaxExpenseEvidenceService()) {
    this.service = service;
    this.verify = this.verify.bind(this);
  }

  async verify(req, res) {
    try {
      const data = await this.service.verify({
        branchId: branchIdFromToken(req),
        employeeId: employeeIdFromToken(req),
        taxExpenseId: Number(req.params.taxExpenseId),
        note: req.body?.note,
      });
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถยืนยันหลักฐานค่าใช้จ่ายได้');
    }
  }
}

module.exports = new TaxExpenseEvidenceController();
module.exports.TaxExpenseEvidenceController = TaxExpenseEvidenceController;
