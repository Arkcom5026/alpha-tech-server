'use strict';

const { branchIdFromToken, employeeIdFromToken, sendError } = require('../shared/taxExpenseContext');
const { TaxExpenseAssessmentService } = require('./taxExpenseAssessmentService');

class TaxExpenseAssessmentController {
  constructor(service = new TaxExpenseAssessmentService()) {
    this.service = service;
    this.getSuggestion = this.getSuggestion.bind(this);
    this.confirm = this.confirm.bind(this);
  }

  async getSuggestion(req, res) {
    try {
      const taxExpenseId = Number(req.params.taxExpenseId);
      const data = await this.service.getSuggestion({
        branchId: branchIdFromToken(req),
        taxExpenseId,
      });
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถสร้างคำแนะนำการประเมินภาษีได้');
    }
  }

  async confirm(req, res) {
    try {
      const taxExpenseId = Number(req.params.taxExpenseId);
      const data = await this.service.confirm({
        branchId: branchIdFromToken(req),
        employeeId: employeeIdFromToken(req),
        taxExpenseId,
        decisions: req.body?.decisions,
        note: req.body?.note,
      });
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถยืนยันผลการประเมินภาษีได้');
    }
  }
}

module.exports = new TaxExpenseAssessmentController();
module.exports.TaxExpenseAssessmentController = TaxExpenseAssessmentController;
