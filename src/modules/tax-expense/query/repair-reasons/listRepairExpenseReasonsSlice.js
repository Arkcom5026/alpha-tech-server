'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { branchIdFromToken, sendError } = require('../../shared/taxExpenseContext');
const { mapRepairAsset } = require('../../../repair/mappers/repairMapper');

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
          repairJob: {
            select: {
              id: true, jobNo: true, deviceModel: true,
              device: true,
              deviceIntake: { select: { id: true, assetDescription: true, snapshot: true } },
              stockItem: {
                select: {
                  id: true, barcode: true, serialNumber: true,
                  product: { select: { name: true, brand: { select: { name: true } }, productType: { select: { name: true } } } },
                },
              },
            },
          },
        },
        orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
        take: 100,
      });
      return res.json({
        ok: true,
        data: rows.map((row) => ({
          ...row,
          repairJob: row.repairJob
            ? { id: row.repairJob.id, jobNo: row.repairJob.jobNo, repairAsset: mapRepairAsset(row.repairJob) }
            : null,
        })),
      });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดเหตุผลค่าใช้จ่ายงานซ่อมได้');
    }
  }
}

module.exports = new ListRepairExpenseReasonsController();
