'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { branchIdFromToken, sendError } = require('../../shared/taxExpenseContext');

class ListRepairExpenseReasonsController {
  async handle(req, res) {
    try {
      const branchId = branchIdFromToken(req);
      const rows = await prisma.repairSubcontract.findMany({
        where: { branchId },
        select: {
          id: true,
          status: true,
          providerName: true,
          expensePayeeId: true,
          sentAt: true,
          repairJob: { select: { id: true, jobNo: true, deviceModel: true } },
        },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: 100,
      });
      return res.json({ ok: true, data: rows });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดเหตุผลค่าใช้จ่ายงานซ่อมได้');
    }
  }
}

module.exports = new ListRepairExpenseReasonsController();
