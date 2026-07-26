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

function buildDailyManagementBrief(jobs, now = new Date()) {
  const alertProjection = buildManagementAlertProjection(jobs, now);
  const summary = alertProjection.managerSummary;
  const alertDigest = buildAlertDigest(alertProjection);
  const escalationQueue = alertProjection.escalationQueue.slice(0, 10);

  return {
    contractVersion: MANAGEMENT_BRIEF_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    headline: buildHeadline(alertProjection),
    attention: alertProjection.attention,
    overview: {
      activeJobs: summary.activeJobs,
      actionableJobs: summary.actionableJobs,
      criticalJobs: summary.criticalJobs,
      overdueJobs: summary.overdueJobs,
      unassignedJobs: summary.unassignedJobs,
      escalationJobs: alertProjection.counters.escalationJobs,
    },
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
module.exports.buildDailyManagementBrief = buildDailyManagementBrief;
