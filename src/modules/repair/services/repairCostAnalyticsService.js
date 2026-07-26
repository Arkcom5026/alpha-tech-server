const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { estimateHistory } = require('./repairEstimateService');
const { workLogHistory, calculateLaborSummary } = require('./repairWorkLogService');
const { partReservationHistory } = require('./repairPartReservationService');
const { calculateRepairFinancialSummary } = require('./repairFinancialSummaryService');

function toMoney(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
}

function reconciliationHistory(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  return Array.isArray(metadata.warrantyClaimReconciliations)
    ? metadata.warrantyClaimReconciliations
    : [];
}

function calculateWarrantyRecovery(job, reconciliations = []) {
  const items = reconciliations.filter(
    (item) => Number(item.repairJobId) === Number(job.id)
  );

  const creditRecoveryAmount = toMoney(
    items
      .filter((item) => ['CREDITED', 'REFUNDED'].includes(item.resolution))
      .reduce((sum, item) => sum + Number(item.creditAmount || 0), 0)
  );

  const replacementRecoveryAmount = toMoney(
    items
      .filter((item) => item.resolution === 'REPLACED')
      .reduce((sum, item) => sum + Number(item.replacementCostRecovery || 0), 0)
  );

  const otherRecoveryAmount = toMoney(
    items.reduce((sum, item) => sum + Number(item.supplierCompensationAmount || 0), 0)
  );

  const totalRecoveryAmount = toMoney(
    creditRecoveryAmount + replacementRecoveryAmount + otherRecoveryAmount
  );

  return {
    items,
    creditRecoveryAmount,
    replacementRecoveryAmount,
    otherRecoveryAmount,
    totalRecoveryAmount,
  };
}

function buildRepairCostAnalytics({
  job,
  estimates = [],
  parts = [],
  workLogs = [],
  partReservations = [],
  claimReconciliations = [],
  calculatedAt = new Date(),
}) {
  const financial = calculateRepairFinancialSummary({ job, estimates, parts, calculatedAt });
  const approvedTotal = toMoney(financial.settlement.approvedTotal);
  const quotedPartAmount = toMoney(financial.comparison.quotedPartAmount);
  const actualPartAmount = toMoney(financial.comparison.actualPartAmount);
  const quotedLaborAmount = toMoney(financial.approvedEstimate?.breakdown?.labor);
  const quotedServiceAmount = toMoney(financial.approvedEstimate?.breakdown?.service);
  const quotedOtherAmount = toMoney(financial.approvedEstimate?.breakdown?.other);
  const laborSummary = calculateLaborSummary(
    workLogs.filter((item) => Number(item.repairJobId) === Number(job.id))
  );
  const actualLaborAmount = toMoney(laborSummary.actualLaborCost);
  const operationalLossItems = partReservations.filter(
    (item) =>
      Number(item.repairJobId) === Number(job.id) &&
      ['LOST', 'DAMAGED'].includes(item.status)
  );
  const lostPartAmount = toMoney(
    operationalLossItems
      .filter((item) => item.status === 'LOST')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const damagedPartAmount = toMoney(
    operationalLossItems
      .filter((item) => item.status === 'DAMAGED')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const operationalLossAmount = toMoney(lostPartAmount + damagedPartAmount);
  const grossCostBasis = toMoney(
    actualPartAmount + actualLaborAmount + operationalLossAmount
  );
  const warrantyRecovery = calculateWarrantyRecovery(job, claimReconciliations);
  const netCostBasis = toMoney(
    Math.max(grossCostBasis - warrantyRecovery.totalRecoveryAmount, 0)
  );
  const estimatedGrossContribution = toMoney(approvedTotal - grossCostBasis);
  const estimatedNetContribution = toMoney(approvedTotal - netCostBasis);
  const grossMarginPercent = approvedTotal > 0
    ? Number(((estimatedGrossContribution / approvedTotal) * 100).toFixed(2))
    : 0;
  const netMarginPercent = approvedTotal > 0
    ? Number(((estimatedNetContribution / approvedTotal) * 100).toFixed(2))
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
      actualLaborAmount,
      lostPartAmount,
      damagedPartAmount,
      operationalLossAmount,
      actualCostBasis: grossCostBasis,
      grossCostBasis,
      netCostBasis,
      laborCostAvailable: laborSummary.entries > 0,
      labor: laborSummary,
      operationalLossItems: operationalLossItems.map((item) => ({
        reservationId: item.id,
        productId: item.productId,
        productName: item.productName || null,
        status: item.status,
        quantity: Number(item.quantity || 0),
        amount: toMoney(item.amount),
        reason: item.resolutionReason || null,
        resolvedAt: item.resolvedAt || null,
      })),
      note: warrantyRecovery.totalRecoveryAmount > 0
        ? 'ต้นทุนสุทธิหักมูลค่าที่กู้คืนได้จากการเคลมแล้ว'
        : operationalLossAmount > 0
          ? 'ต้นทุนจริงรวมอะไหล่ติดตั้ง แรงงาน และอะไหล่ที่สูญหายหรือเสียหาย'
          : laborSummary.entries > 0
            ? 'ต้นทุนจริงรวมอะไหล่และแรงงานจาก Work Log ของช่าง'
            : 'ยังไม่มี Work Log ของช่าง จึงใช้ต้นทุนอะไหล่จริงเป็น cost basis ขั้นต่ำ',
    },
    warrantyRecovery: {
      creditRecoveryAmount: warrantyRecovery.creditRecoveryAmount,
      replacementRecoveryAmount: warrantyRecovery.replacementRecoveryAmount,
      otherRecoveryAmount: warrantyRecovery.otherRecoveryAmount,
      totalRecoveryAmount: warrantyRecovery.totalRecoveryAmount,
      recoveryCount: warrantyRecovery.items.length,
      recoveries: warrantyRecovery.items,
    },
    profitability: {
      estimatedGrossContribution,
      grossMarginPercent,
      estimatedNetContribution,
      netMarginPercent,
      lossMaking: estimatedNetContribution < 0,
      breakEven: estimatedNetContribution === 0,
      profitable: estimatedNetContribution > 0,
    },
    variance: {
      partVariance: toMoney(actualPartAmount - quotedPartAmount),
      laborVariance: toMoney(actualLaborAmount - quotedLaborAmount),
      operationalLossVariance: operationalLossAmount,
      warrantyRecoveryVariance: toMoney(-warrantyRecovery.totalRecoveryAmount),
      totalCostVariance: toMoney(netCostBasis - (quotedPartAmount + quotedLaborAmount)),
      actualPartOverEstimate: actualPartAmount > quotedPartAmount,
      actualLaborOverEstimate: actualLaborAmount > quotedLaborAmount,
      hasOperationalLoss: operationalLossAmount > 0,
      hasWarrantyRecovery: warrantyRecovery.totalRecoveryAmount > 0,
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
      workLogs: workLogHistory(asset.metadata),
      partReservations: partReservationHistory(asset.metadata),
      claimReconciliations: reconciliationHistory(asset.metadata),
    });
  }
}

module.exports = new RepairCostAnalyticsService();
module.exports.RepairCostAnalyticsService = RepairCostAnalyticsService;
module.exports.buildRepairCostAnalytics = buildRepairCostAnalytics;
module.exports.calculateWarrantyRecovery = calculateWarrantyRecovery;
module.exports.reconciliationHistory = reconciliationHistory;
module.exports.toMoney = toMoney;
