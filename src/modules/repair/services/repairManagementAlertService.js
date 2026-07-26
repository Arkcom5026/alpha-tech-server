const repairRepository = require('../repositories/repairRepository');
const {
  buildOperationalDecisionProjection,
  DECISION_ACTION,
} = require('./repairOperationalDecisionService');

const MANAGEMENT_ALERT_CONTRACT_VERSION = 'repair-management-alert.v1';

const ALERT_SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
});

const ALERT_PRIORITY = Object.freeze({ CRITICAL: 0, WARNING: 1, INFO: 2 });

function alertItem(code, severity, title, message, details = {}) {
  return { code, severity, title, message, details };
}

function buildManagementAlerts(decisionProjection) {
  const summary = decisionProjection.managerSummary;
  const alerts = [];

  if (summary.criticalJobs > 0) {
    alerts.push(alertItem(
      'CRITICAL_REPAIR_JOBS',
      ALERT_SEVERITY.CRITICAL,
      'มีงานซ่อมวิกฤตที่ต้องจัดการทันที',
      `พบงานซ่อมระดับวิกฤต ${summary.criticalJobs} งาน`,
      { count: summary.criticalJobs }
    ));
  }

  if (summary.unassignedJobs > 0) {
    alerts.push(alertItem(
      'UNASSIGNED_REPAIR_JOBS',
      ALERT_SEVERITY.CRITICAL,
      'มีงานซ่อมที่ยังไม่มีช่างรับผิดชอบ',
      `พบงานซ่อมที่ยังไม่มีช่าง ${summary.unassignedJobs} งาน`,
      { count: summary.unassignedJobs }
    ));
  }

  if (summary.overdueJobs > 0) {
    alerts.push(alertItem(
      'SLA_OVERDUE_REPAIR_JOBS',
      summary.slaOverdueRate >= 0.5 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.WARNING,
      'มีงานซ่อมเกิน SLA',
      `พบงานเกิน SLA ${summary.overdueJobs} งาน`,
      { count: summary.overdueJobs, rate: summary.slaOverdueRate }
    ));
  }

  if (summary.customerContactJobs > 0) {
    alerts.push(alertItem(
      'CUSTOMER_CONTACT_REQUIRED',
      ALERT_SEVERITY.WARNING,
      'มีงานที่ควรติดต่อลูกค้า',
      `ควรติดต่อลูกค้าใน ${summary.customerContactJobs} งาน`,
      { count: summary.customerContactJobs }
    ));
  }

  if (summary.partsFollowUpJobs > 0) {
    alerts.push(alertItem(
      'PARTS_FOLLOW_UP_REQUIRED',
      ALERT_SEVERITY.WARNING,
      'มีงานที่ควรติดตามอะไหล่',
      `ควรติดตามอะไหล่ใน ${summary.partsFollowUpJobs} งาน`,
      { count: summary.partsFollowUpJobs }
    ));
  }

  if (summary.slaAtRiskJobs > 0) {
    alerts.push(alertItem(
      'SLA_AT_RISK_REPAIR_JOBS',
      ALERT_SEVERITY.WARNING,
      'มีงานซ่อมใกล้เกิน SLA',
      `พบงานใกล้เกิน SLA ${summary.slaAtRiskJobs} งาน`,
      { count: summary.slaAtRiskJobs }
    ));
  }

  if (summary.actionableJobs === 0) {
    alerts.push(alertItem(
      'NO_IMMEDIATE_MANAGEMENT_ACTION',
      ALERT_SEVERITY.INFO,
      'ไม่มีงานที่ต้องจัดการเร่งด่วน',
      'ภาพรวมงานซ่อมยังอยู่ในภาวะปกติ'
    ));
  }

  return alerts.sort((a, b) => ALERT_PRIORITY[a.severity] - ALERT_PRIORITY[b.severity] || a.code.localeCompare(b.code));
}

function buildEscalationQueue(decisionProjection) {
  return decisionProjection.priorityQueue
    .filter((item) => item.highestRiskLevel === 'CRITICAL' || item.sla.overdue)
    .map((item) => ({
      repairJobId: item.repairJobId,
      repairJobNo: item.repairJobNo,
      status: item.status,
      action: item.action,
      reason: item.reason,
      technicianId: item.technicianId,
      customerId: item.customerId,
      highestRiskLevel: item.highestRiskLevel,
      riskCodes: item.riskCodes,
      riskCount: item.riskCount,
      overdueHours: item.sla.overdueHours,
      escalationReason: item.highestRiskLevel === 'CRITICAL'
        ? 'CRITICAL_RISK'
        : 'SLA_OVERDUE',
    }));
}

function buildManagementAlertProjection(jobs, now = new Date()) {
  const decisionProjection = buildOperationalDecisionProjection(jobs, now);
  const alerts = buildManagementAlerts(decisionProjection);
  const escalationQueue = buildEscalationQueue(decisionProjection);

  return {
    contractVersion: MANAGEMENT_ALERT_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    attention: decisionProjection.managerSummary.attention,
    counters: {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter((item) => item.severity === ALERT_SEVERITY.CRITICAL).length,
      warningAlerts: alerts.filter((item) => item.severity === ALERT_SEVERITY.WARNING).length,
      infoAlerts: alerts.filter((item) => item.severity === ALERT_SEVERITY.INFO).length,
      escalationJobs: escalationQueue.length,
    },
    managerSummary: decisionProjection.managerSummary,
    alerts,
    escalationQueue,
    topActions: decisionProjection.managerSummary.topActions,
  };
}

class RepairManagementAlertService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getDashboard(actor, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 200), 1), 500);
    const jobs = await this.repository.listRepairJobs(actor.branchId, {
      status: null,
      stockItemId: null,
      customerId: null,
      limit,
      offset: 0,
    });
    return buildManagementAlertProjection(jobs);
  }
}

module.exports = new RepairManagementAlertService();
module.exports.RepairManagementAlertService = RepairManagementAlertService;
module.exports.MANAGEMENT_ALERT_CONTRACT_VERSION = MANAGEMENT_ALERT_CONTRACT_VERSION;
module.exports.ALERT_SEVERITY = ALERT_SEVERITY;
module.exports.ALERT_PRIORITY = ALERT_PRIORITY;
module.exports.buildManagementAlerts = buildManagementAlerts;
module.exports.buildEscalationQueue = buildEscalationQueue;
module.exports.buildManagementAlertProjection = buildManagementAlertProjection;
module.exports.DECISION_ACTION = DECISION_ACTION;
