const { Prisma } = require('@prisma/client');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const { estimateHistory } = require('./repairEstimateService');
const {
  calculateActualPartUsageSummary,
} = require('./repairPartUsageSummaryService');

const ESTIMATE_ITEM_TYPES = Object.freeze(['LABOR', 'PART', 'SERVICE', 'OTHER']);

function decimal(value) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value || 0);
}

function money(value) {
  return decimal(value).toDecimalPlaces(2).toFixed(2);
}

function latestApprovedEstimate(repairJobId, estimates = []) {
  return estimates
    .filter(
      (estimate) =>
        Number(estimate.repairJobId) === Number(repairJobId) &&
        estimate.status === 'APPROVED'
    )
    .sort((left, right) => {
      const leftAt = Date.parse(left.decidedAt || left.createdAt || 0) || 0;
      const rightAt = Date.parse(right.decidedAt || right.createdAt || 0) || 0;
      return rightAt - leftAt;
    })[0] || null;
}

function estimateBreakdown(estimate) {
  const totals = Object.fromEntries(
    ESTIMATE_ITEM_TYPES.map((type) => [type, new Prisma.Decimal(0)])
  );

  for (const item of estimate?.items || []) {
    const type = String(item?.type || '').toUpperCase();
    if (!ESTIMATE_ITEM_TYPES.includes(type)) continue;
    const amount = decimal(item.amount);
    if (amount.isNegative()) {
      throw new RepairError(
        RepairFailureCode.REPAIR_FINANCIAL_DATA_INCONSISTENT,
        'ข้อมูลยอดเงินในใบเสนอราคางานซ่อมไม่ถูกต้อง',
        409,
        { estimateId: estimate.id, type, amount: amount.toFixed(2) }
      );
    }
    totals[type] = totals[type].add(amount);
  }

  return Object.fromEntries(
    ESTIMATE_ITEM_TYPES.map((type) => [type.toLowerCase(), totals[type].toFixed(2)])
  );
}

function calculateRepairFinancialSummary({
  job,
  estimates = [],
  parts = [],
  calculatedAt = new Date(),
}) {
  if (!job?.id) {
    throw new TypeError('job is required');
  }

  const estimate = latestApprovedEstimate(job.id, estimates);
  const partUsage = calculateActualPartUsageSummary(job.id, parts, calculatedAt);
  const breakdown = estimateBreakdown(estimate);
  const approvedTotal = decimal(estimate?.total || 0);
  const depositPaid = decimal(job.depositPaid || 0);

  if (approvedTotal.isNegative() || depositPaid.isNegative()) {
    throw new RepairError(
      RepairFailureCode.REPAIR_FINANCIAL_DATA_INCONSISTENT,
      'ข้อมูลยอดเงินของใบงานซ่อมไม่ถูกต้อง',
      409,
      {
        approvedTotal: approvedTotal.toFixed(2),
        depositPaid: depositPaid.toFixed(2),
      }
    );
  }

  const actualPartAmount = decimal(partUsage.totals.actualPartAmount);
  const quotedPartAmount = decimal(breakdown.part);
  const partVariance = actualPartAmount.sub(quotedPartAmount);
  const outstandingBalance = Prisma.Decimal.max(approvedTotal.sub(depositPaid), 0);
  const overpaidAmount = Prisma.Decimal.max(depositPaid.sub(approvedTotal), 0);

  return {
    repairJobId: Number(job.id),
    repairJobNo: job.jobNo || null,
    currency: estimate?.currency || 'THB',
    approvedEstimate: estimate
      ? {
          id: estimate.id,
          status: estimate.status,
          approvedAt: estimate.decidedAt || null,
          subtotal: money(estimate.subtotal),
          total: approvedTotal.toFixed(2),
          breakdown,
        }
      : null,
    actualPartUsage: partUsage,
    comparison: {
      quotedPartAmount: quotedPartAmount.toFixed(2),
      actualPartAmount: actualPartAmount.toFixed(2),
      partVariance: partVariance.toFixed(2),
    },
    settlement: {
      approvedTotal: approvedTotal.toFixed(2),
      depositPaid: depositPaid.toFixed(2),
      outstandingBalance: outstandingBalance.toFixed(2),
      overpaidAmount: overpaidAmount.toFixed(2),
    },
    readiness: {
      hasApprovedEstimate: Boolean(estimate),
      hasOutstandingBalance: outstandingBalance.greaterThan(0),
      financiallyReadyForBilling: Boolean(estimate),
    },
    calculatedAt: calculatedAt.toISOString(),
  };
}

class RepairFinancialSummaryService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getSummary(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }
    if (!job.serviceAssetId) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_REQUIRED,
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนสรุปยอดงานซ่อม',
        409
      );
    }

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

    return calculateRepairFinancialSummary({
      job,
      estimates: estimateHistory(asset.metadata),
      parts: job.partsUsed || [],
    });
  }
}

module.exports = new RepairFinancialSummaryService();
module.exports.RepairFinancialSummaryService = RepairFinancialSummaryService;
module.exports.calculateRepairFinancialSummary = calculateRepairFinancialSummary;
module.exports.latestApprovedEstimate = latestApprovedEstimate;
module.exports.estimateBreakdown = estimateBreakdown;
module.exports.ESTIMATE_ITEM_TYPES = ESTIMATE_ITEM_TYPES;
