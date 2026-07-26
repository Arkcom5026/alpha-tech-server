const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { estimateHistory } = require('./repairEstimateService');
const { calculateRepairFinancialSummary } = require('./repairFinancialSummaryService');

function toMoney(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function buildRepairCostAnalytics({ job, estimates = [], parts = [], calculatedAt = new Date() }) {
  const financial = calculateRepairFinancialSummary({ job, estimates, parts, calculatedAt });
  const approvedTotal = toMoney(financial.settlement.approvedTotal);
  const quotedPartAmount = toMoney(financial.comparison.quotedPartAmount);
  const actualPartAmount = toMoney(financial.comparison.actualPartAmount);
  const quotedLaborAmount = toMoney(financial.approvedEstimate?.breakdown?.labor);
  const quotedServiceAmount = toMoney(financial.approvedEstimate?.breakdown?.service);
  const quotedOtherAmount = toMoney(financial.approvedEstimate?.breakdown?.other);
  const estimatedGrossContribution = toMoney(approvedTotal - actualPartAmount);
  const actualCostBasis = actualPartAmount;
  const grossMarginPercent = approvedTotal > 0
    ? Number(((estimatedGrossContribution / approvedTotal) * 100).toFixed(2))
    : 0;

  return {
    repairJobId: Number(job.id),
    repairJobNo: job.jobNo || null,
    currency: financial.currency || 'THB',
    revenue: {
      approvedTotal,
      quotedLaborAmount,
      quotedPartAmount,
      quotedServiceAmount,
      quotedOtherAmount,
    },
    cost: {
      actualPartAmount,
      actualCostBasis,
      laborCostAvailable: false,
      note: 'ยังไม่มีฐานต้นทุนแรงงานจริง จึงใช้ต้นทุนอะไหล่จริงเป็น cost basis ขั้นต่ำ',
    },
    profitability: {
      estimatedGrossContribution,
      grossMarginPercent,
      lossMaking: estimatedGrossContribution < 0,
      breakEven: estimatedGrossContribution === 0,
      profitable: estimatedGrossContribution > 0,
    },
    variance: {
      partVariance: toMoney(actualPartAmount - quotedPartAmount),
      actualPartOverEstimate: actualPartAmount > quotedPartAmount,
    },
    source: financial,
    calculatedAt: calculatedAt.toISOString(),
  };
}

class RepairCostAnalyticsService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getForRepairJob(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนวิเคราะห์ต้นทุน', 409);
    }
    const assetRepository = new ServiceAssetRepository(this.repository.prisma);
    const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }
    return buildRepairCostAnalytics({
      job,
      estimates: estimateHistory(asset.metadata),
      parts: job.partsUsed || [],
    });
  }
}

module.exports = new RepairCostAnalyticsService();
module.exports.RepairCostAnalyticsService = RepairCostAnalyticsService;
module.exports.buildRepairCostAnalytics = buildRepairCostAnalytics;
module.exports.toMoney = toMoney;
