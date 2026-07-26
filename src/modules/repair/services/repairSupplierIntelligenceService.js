const repairRepository = require('../repositories/repairRepository');
const { toMoney } = require('./repairCostAnalyticsService');

const SUPPLIER_INTELLIGENCE_CONTRACT_VERSION = 'repair-supplier-intelligence.v1';

function dateDiffHours(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Number(((endDate - startDate) / 3600000).toFixed(2));
}

function percent(part, total) {
  if (!total) return 0;
  return Number(((part / total) * 100).toFixed(2));
}

function recoveryValue(claim) {
  if (['CREDITED', 'REFUNDED'].includes(claim.resolution)) {
    return toMoney(claim.creditAmount);
  }
  if (claim.resolution === 'REPLACED') {
    return toMoney(claim.replacementStockItem?.costPrice);
  }
  return 0;
}

function buildSupplierReliabilityScore(metrics) {
  const resolutionPenalty = Math.round((1 - metrics.resolutionRate) * 30);
  const rejectPenalty = Math.round(metrics.rejectionRate * 35);
  const cancellationPenalty = Math.round(metrics.cancellationRate * 15);
  const turnaroundPenalty = metrics.averageResolutionHours == null
    ? 10
    : Math.min(Math.round(metrics.averageResolutionHours / 24), 20);
  return Math.max(0, Math.min(100, 100 - resolutionPenalty - rejectPenalty - cancellationPenalty - turnaroundPenalty));
}

function buildSupplierIntelligenceProjection(claims, now = new Date()) {
  const groups = new Map();

  for (const claim of claims) {
    const supplierId = claim.supplierId ? Number(claim.supplierId) : null;
    const key = supplierId == null ? 'UNASSIGNED' : String(supplierId);
    if (!groups.has(key)) {
      groups.set(key, {
        supplierId,
        supplierName: claim.supplier?.name || claim.serviceProvider || null,
        claims: [],
      });
    }
    groups.get(key).claims.push(claim);
  }

  const suppliers = [...groups.values()].map((group) => {
    const totalClaims = group.claims.length;
    const resolvedClaims = group.claims.filter((claim) => claim.status === 'RESOLVED');
    const cancelledClaims = group.claims.filter((claim) => claim.status === 'CANCELLED');
    const rejectedClaims = group.claims.filter(
      (claim) => claim.status === 'REJECTED' || claim.resolution === 'REJECTED'
    );
    const replacementClaims = group.claims.filter((claim) => claim.resolution === 'REPLACED');
    const creditClaims = group.claims.filter((claim) => claim.resolution === 'CREDITED');
    const refundedClaims = group.claims.filter((claim) => claim.resolution === 'REFUNDED');
    const repairedClaims = group.claims.filter((claim) => claim.resolution === 'REPAIRED');
    const writtenOffClaims = group.claims.filter((claim) => claim.resolution === 'WRITTEN_OFF');
    const activeClaims = group.claims.filter(
      (claim) => !['RESOLVED', 'CANCELLED'].includes(claim.status)
    );
    const resolutionDurations = resolvedClaims
      .map((claim) => dateDiffHours(claim.openedAt, claim.resolvedAt))
      .filter((value) => value != null);
    const totalRecoveryAmount = toMoney(
      resolvedClaims.reduce((sum, claim) => sum + recoveryValue(claim), 0)
    );
    const resolutionRate = totalClaims ? resolvedClaims.length / totalClaims : 0;
    const rejectionRate = totalClaims ? rejectedClaims.length / totalClaims : 0;
    const cancellationRate = totalClaims ? cancelledClaims.length / totalClaims : 0;
    const averageResolutionHours = resolutionDurations.length
      ? Number((resolutionDurations.reduce((sum, value) => sum + value, 0) / resolutionDurations.length).toFixed(2))
      : null;
    const oldestActiveAgeHours = activeClaims.reduce((max, claim) => {
      const age = dateDiffHours(claim.openedAt, now);
      return age == null ? max : Math.max(max, age);
    }, 0);

    const metrics = {
      resolutionRate,
      rejectionRate,
      cancellationRate,
      averageResolutionHours,
    };

    return {
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      counts: {
        totalClaims,
        activeClaims: activeClaims.length,
        resolvedClaims: resolvedClaims.length,
        cancelledClaims: cancelledClaims.length,
        rejectedClaims: rejectedClaims.length,
        replacementClaims: replacementClaims.length,
        creditClaims: creditClaims.length,
        refundedClaims: refundedClaims.length,
        repairedClaims: repairedClaims.length,
        writtenOffClaims: writtenOffClaims.length,
      },
      rates: {
        resolutionPercent: percent(resolvedClaims.length, totalClaims),
        rejectionPercent: percent(rejectedClaims.length, totalClaims),
        cancellationPercent: percent(cancelledClaims.length, totalClaims),
        replacementPercent: percent(replacementClaims.length, totalClaims),
        creditPercent: percent(creditClaims.length, totalClaims),
        refundPercent: percent(refundedClaims.length, totalClaims),
      },
      turnaround: {
        averageResolutionHours,
        averageResolutionDays: averageResolutionHours == null
          ? null
          : Number((averageResolutionHours / 24).toFixed(2)),
        oldestActiveAgeHours: Number(oldestActiveAgeHours.toFixed(2)),
      },
      recovery: {
        currency: 'THB',
        totalRecoveryAmount,
        averageRecoveryAmount: resolvedClaims.length
          ? toMoney(totalRecoveryAmount / resolvedClaims.length)
          : 0,
        recoveryClaimCount: resolvedClaims.filter((claim) => recoveryValue(claim) > 0).length,
      },
      reliabilityScore: buildSupplierReliabilityScore(metrics),
    };
  });

  suppliers.sort(
    (a, b) => b.reliabilityScore - a.reliabilityScore
      || b.recovery.totalRecoveryAmount - a.recovery.totalRecoveryAmount
      || b.counts.totalClaims - a.counts.totalClaims
  );

  return {
    contractVersion: SUPPLIER_INTELLIGENCE_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    summary: {
      supplierCount: suppliers.filter((item) => item.supplierId != null).length,
      unassignedClaimCount: suppliers.find((item) => item.supplierId == null)?.counts.totalClaims || 0,
      totalClaims: claims.length,
      totalActiveClaims: suppliers.reduce((sum, item) => sum + item.counts.activeClaims, 0),
      totalResolvedClaims: suppliers.reduce((sum, item) => sum + item.counts.resolvedClaims, 0),
      totalRecoveryAmount: toMoney(
        suppliers.reduce((sum, item) => sum + item.recovery.totalRecoveryAmount, 0)
      ),
    },
    suppliers,
  };
}

class RepairSupplierIntelligenceService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getDashboard(actor, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 500), 1), 1000);
    const claims = await this.repository.prisma.warrantyClaim.findMany({
      where: {
        branchId: Number(actor.branchId),
        ...(query.supplierId ? { supplierId: Number(query.supplierId) } : {}),
      },
      include: {
        supplier: true,
        replacementStockItem: true,
      },
      orderBy: { openedAt: 'desc' },
      take: limit,
    });

    return buildSupplierIntelligenceProjection(claims);
  }
}

module.exports = new RepairSupplierIntelligenceService();
module.exports.RepairSupplierIntelligenceService = RepairSupplierIntelligenceService;
module.exports.SUPPLIER_INTELLIGENCE_CONTRACT_VERSION = SUPPLIER_INTELLIGENCE_CONTRACT_VERSION;
module.exports.dateDiffHours = dateDiffHours;
module.exports.recoveryValue = recoveryValue;
module.exports.buildSupplierReliabilityScore = buildSupplierReliabilityScore;
module.exports.buildSupplierIntelligenceProjection = buildSupplierIntelligenceProjection;
