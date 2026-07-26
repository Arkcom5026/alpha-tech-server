const repairRepository = require('../repositories/repairRepository');
const {
  buildManagementAlertProjection,
  ALERT_PRIORITY,
} = require('./repairManagementAlertService');

const MANAGEMENT_BRIEF_CONTRACT_VERSION = 'repair-management-brief.v1';

function buildHeadline(alertProjection) {
  if (alertProjection.attention === 'IMMEDIATE') {
    return 'มีงานซ่อมที่ต้องจัดการทันที';
  }
  if (alertProjection.attention === 'REQUIRED') {
    return 'มีงานซ่อมที่ต้องติดตามในรอบนี้';
  }
  return 'ภาพรวมงานซ่อมอยู่ในภาวะปกติ';
}

function buildAlertDigest(alertProjection) {
  return alertProjection.alerts
    .map((item) => ({
      code: item.code,
      severity: item.severity,
      title: item.title,
      message: item.message,
      count: Number(item.details?.count || 0),
    }))
    .sort((a, b) => ALERT_PRIORITY[a.severity] - ALERT_PRIORITY[b.severity] || b.count - a.count || a.code.localeCompare(b.code));
}

function buildManagementKpiSnapshot(alertProjection) {
  const summary = alertProjection.managerSummary;
  const activeJobs = Math.max(summary.activeJobs, 1);
  return {
    activeJobs: summary.activeJobs,
    actionableJobs: summary.actionableJobs,
    criticalJobs: summary.criticalJobs,
    overdueJobs: summary.overdueJobs,
    unassignedJobs: summary.unassignedJobs,
    escalationJobs: alertProjection.counters.escalationJobs,
    actionableRate: summary.actionableRate,
    slaOverdueRate: summary.slaOverdueRate,
    assignmentCoverageRate: Number(((summary.activeJobs - summary.unassignedJobs) / activeJobs).toFixed(2)),
    escalationRate: Number((alertProjection.counters.escalationJobs / activeJobs).toFixed(2)),
  };
}

function buildTrendProjection(current, baseline = null) {
  if (!baseline || typeof baseline !== 'object') {
    return {
      available: false,
      direction: 'STABLE',
      deltas: {},
    };
  }

  const fields = ['activeJobs', 'actionableJobs', 'criticalJobs', 'overdueJobs', 'unassignedJobs', 'escalationJobs'];
  const deltas = Object.fromEntries(fields.map((field) => [
    field,
    Number(current[field] || 0) - Number(baseline[field] || 0),
  ]));
  const deterioration = deltas.criticalJobs + deltas.overdueJobs + deltas.unassignedJobs + deltas.escalationJobs;
  const direction = deterioration > 0 ? 'WORSENING' : deterioration < 0 ? 'IMPROVING' : 'STABLE';

  return {
    available: true,
    direction,
    deltas,
  };
}

function buildDailyManagementBrief(jobs, now = new Date(), baseline = null) {
  const alertProjection = buildManagementAlertProjection(jobs, now);
  const alertDigest = buildAlertDigest(alertProjection);
  const escalationQueue = alertProjection.escalationQueue.slice(0, 10);
  const kpis = buildManagementKpiSnapshot(alertProjection);

  return {
    contractVersion: MANAGEMENT_BRIEF_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    headline: buildHeadline(alertProjection),
    attention: alertProjection.attention,
    overview: {
      activeJobs: kpis.activeJobs,
      actionableJobs: kpis.actionableJobs,
      criticalJobs: kpis.criticalJobs,
      overdueJobs: kpis.overdueJobs,
      unassignedJobs: kpis.unassignedJobs,
      escalationJobs: kpis.escalationJobs,
    },
    kpis,
    trend: buildTrendProjection(kpis, baseline),
    alertCounters: alertProjection.counters,
    alertDigest,
    escalationQueue,
    topActions: alertProjection.topActions,
  };
}

class RepairManagementBriefService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getDailyBrief(actor, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 200), 1), 500);
    const jobs = await this.repository.listRepairJobs(actor.branchId, {
      status: null,
      stockItemId: null,
      customerId: null,
      limit,
      offset: 0,
    });
    return buildDailyManagementBrief(jobs);
  }
}

module.exports = new RepairManagementBriefService();
module.exports.RepairManagementBriefService = RepairManagementBriefService;
module.exports.MANAGEMENT_BRIEF_CONTRACT_VERSION = MANAGEMENT_BRIEF_CONTRACT_VERSION;
module.exports.buildHeadline = buildHeadline;
module.exports.buildAlertDigest = buildAlertDigest;
module.exports.buildManagementKpiSnapshot = buildManagementKpiSnapshot;
module.exports.buildTrendProjection = buildTrendProjection;
module.exports.buildDailyManagementBrief = buildDailyManagementBrief;