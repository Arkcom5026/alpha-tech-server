const { Prisma } = require('@prisma/client');
const repairPartUsageRepository = require('../repositories/repairPartUsageRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { partReversalHistory } = require('./repairPartReversalService');
const { partReservationHistory } = require('./repairPartReservationService');

function toDecimal(value) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function calculateActualPartUsageSummary(
  repairJobId,
  parts = [],
  reversals = [],
  reservations = [],
  calculatedAt = new Date()
) {
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
      status: 'INSTALLED',
      quantity,
      unitPrice: unitPrice.toFixed(2),
      lineAmount: lineAmount.toFixed(2),
    };
  });

  const reversalLines = reversals
    .filter((item) => Number(item.repairJobId) === Number(repairJobId))
    .map((item) => ({
      partItemId: Number(item.partItemId),
      productId: Number(item.productId),
      productName: item.productName || null,
      status: 'REVERSED',
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      lineAmount: Number(item.amount || 0).toFixed(2),
      reason: item.reason || null,
      reversedByEmployeeId: item.reversedByEmployeeId || null,
      reversedAt: item.reversedAt || null,
    }));

  const reservationLines = reservations
    .filter((item) => Number(item.repairJobId) === Number(repairJobId))
    .map((item) => ({
      reservationId: item.id,
      productId: Number(item.productId),
      productName: item.productName || null,
      status: item.status,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0).toFixed(2),
      lineAmount: Number(item.amount || 0).toFixed(2),
      note: item.note || null,
      reason: item.resolutionReason || null,
      reservedByEmployeeId: item.reservedByEmployeeId || null,
      reservedAt: item.reservedAt || null,
      resolvedByEmployeeId: item.resolvedByEmployeeId || null,
      resolvedAt: item.resolvedAt || null,
      installedPartItemId: item.installedPartItemId || null,
    }));

  const sumLines = (items, statuses) => {
    const selected = items.filter((item) => statuses.includes(item.status));
    return {
      quantity: selected.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      amount: Number(
        selected.reduce((sum, item) => sum + Number(item.lineAmount || 0), 0).toFixed(2)
      ),
    };
  };

  const reversed = sumLines(reversalLines, ['REVERSED']);
  const reserved = sumLines(reservationLines, ['RESERVED']);
  const released = sumLines(reservationLines, ['RELEASE']);
  const lost = sumLines(reservationLines, ['LOST']);
  const damaged = sumLines(reservationLines, ['DAMAGED']);

  return {
    repairJobId: Number(repairJobId),
    lines,
    reversals: reversalLines,
    reservations: reservationLines,
    totals: {
      actualPartQuantity: totalQuantity,
      actualPartAmount: totalAmount.toFixed(2),
      reservedPartQuantity: reserved.quantity,
      reservedPartAmount: reserved.amount.toFixed(2),
      releasedPartQuantity: released.quantity,
      releasedPartAmount: released.amount.toFixed(2),
      reversedPartQuantity: reversed.quantity,
      reversedPartAmount: reversed.amount.toFixed(2),
      lostPartQuantity: lost.quantity,
      lostPartAmount: lost.amount.toFixed(2),
      damagedPartQuantity: damaged.quantity,
      damagedPartAmount: damaged.amount.toFixed(2),
      operationalLossAmount: Number((lost.amount + damaged.amount).toFixed(2)).toFixed(2),
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
    let reversals = [];
    let reservations = [];

    if (job.serviceAssetId) {
      const assetRepository = new ServiceAssetRepository(this.repository.prisma);
      const asset = await assetRepository.findServiceAsset(
        actor.branchId,
        job.serviceAssetId
      );
      if (!asset) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
          'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
          404
        );
      }
      reversals = partReversalHistory(asset.metadata);
      reservations = partReservationHistory(asset.metadata);
    }

    return calculateActualPartUsageSummary(
      job.id,
      parts,
      reversals,
      reservations
    );
  }
}

module.exports = new RepairPartUsageSummaryService();
module.exports.RepairPartUsageSummaryService = RepairPartUsageSummaryService;
module.exports.calculateActualPartUsageSummary = calculateActualPartUsageSummary;
