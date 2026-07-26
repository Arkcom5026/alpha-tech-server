const { Prisma } = require('@prisma/client');
const repairPartUsageRepository = require('../repositories/repairPartUsageRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

function toDecimal(value) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function calculateActualPartUsageSummary(repairJobId, parts = [], calculatedAt = new Date()) {
  let totalQuantity = 0;
  let totalAmount = new Prisma.Decimal(0);

  const lines = parts.map((part) => {
    const quantity = Number(part.qtyUsed);
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new RepairError(
        RepairFailureCode.REPAIR_PART_USAGE_DATA_INCONSISTENT,
        'ข้อมูลจำนวนอะไหล่ที่ใช้ในงานซ่อมไม่ถูกต้อง',
        409,
        { partItemId: part.id, qtyUsed: part.qtyUsed }
      );
    }

    const unitPrice = toDecimal(part.unitPrice);
    if (unitPrice.isNegative()) {
      throw new RepairError(
        RepairFailureCode.REPAIR_PART_USAGE_DATA_INCONSISTENT,
        'ข้อมูลราคาอะไหล่ที่ใช้ในงานซ่อมไม่ถูกต้อง',
        409,
        { partItemId: part.id, unitPrice: unitPrice.toFixed(2) }
      );
    }

    const lineAmount = unitPrice.mul(quantity);
    totalQuantity += quantity;
    totalAmount = totalAmount.add(lineAmount);

    return {
      partItemId: Number(part.id),
      productId: Number(part.productId),
      productName: part.product?.name || null,
      quantity,
      unitPrice: unitPrice.toFixed(2),
      lineAmount: lineAmount.toFixed(2),
    };
  });

  return {
    repairJobId: Number(repairJobId),
    lines,
    totals: {
      actualPartQuantity: totalQuantity,
      actualPartAmount: totalAmount.toFixed(2),
    },
    calculatedAt: calculatedAt.toISOString(),
  };
}

class RepairPartUsageSummaryService {
  constructor(repository = repairPartUsageRepository) {
    this.repository = repository;
  }

  async getActualUsageSummary(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }

    const parts = await this.repository.listPartUsage(job.id);
    return calculateActualPartUsageSummary(job.id, parts);
  }
}

module.exports = new RepairPartUsageSummaryService();
module.exports.RepairPartUsageSummaryService = RepairPartUsageSummaryService;
module.exports.calculateActualPartUsageSummary = calculateActualPartUsageSummary;
