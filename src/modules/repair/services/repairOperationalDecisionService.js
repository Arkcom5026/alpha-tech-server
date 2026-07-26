const repairRepository = require('../repositories/repairRepository');
const {
  ACTIVE_STATUSES,
  buildSlaProjection,
} = require('./repairOperationalIntelligenceService');
const {
  buildJobOperationalRisks,
  RISK_PRIORITY,
} = require('./repairOperationalRiskService');

const DECISION_CONTRACT_VERSION = 'repair-operational-decision.v1';

const DECISION_ACTION = Object.freeze({
  ASSIGN_TECHNICIAN: 'ASSIGN_TECHNICIAN',
  UPDATE_JOB: 'UPDATE_JOB',
  CONTACT_CUSTOMER: 'CONTACT_CUSTOMER',
  FOLLOW_UP_PARTS: 'FOLLOW_UP_PARTS',
  REVIEW_WARRANTY_CLAIM: 'REVIEW_WARRANTY_CLAIM',
  REVIEW_REPEAT_REPAIR: 'REVIEW_REPEAT_REPAIR',
  EXPEDITE_JOB: 'EXPEDITE_JOB',
  MONITOR: 'MONITOR',
  NONE: 'NONE',
});

function highestRiskLevel(risks) {
  if (!risks.length) return null;
  return risks.reduce((current, item) => (
    current == null || RISK_PRIORITY[item.level] < RISK_PRIORITY[current]
      ? item.level
      : current
  ), null);
}

function actionForRiskCodes(riskCodes, job) {
  const codes = new Set(riskCodes);
  if (codes.has('UNASSIGNED_ACTIVE_JOB')) return DECISION_ACTION.ASSIGN_TECHNICIAN;
  if (codes.has('ACTIVE_WARRANTY_CLAIM_RISK')) return DECISION_ACTION.REVIEW_WARRANTY_CLAIM;
  if (codes.has('REPEAT_REPAIR_RISK')) return DECISION_ACTION.REVIEW_REPEAT_REPAIR;
  if (codes.has('PARTS_DELAY_RISK')) return DECISION_ACTION.FOLLOW_UP_PARTS;
  if (codes.has('APPROVAL_DELAY_RISK')) return DECISION_ACTION.CONTACT_CUSTOMER;
  if (codes.has('SLA_OVERDUE') || codes.has('SLA_AT_RISK')) return DECISION_ACTION.EXPEDITE_JOB;
  if (codes.has('STALE_OPERATIONAL_UPDATE')) return DECISION_ACTION.UPDATE_JOB;
  if (ACTIVE_STATUSES.has(job.status)) return DECISION_ACTION.MONITOR;
  return DECISION_ACTION.NONE;
}

function buildDecisionReason(action, riskCodes, job) {
  switch (action) {
    case DECISION_ACTION.ASSIGN_TECHNICIAN:
      return 'ใบงานยังดำเนินการอยู่แต่ไม่มีช่างรับผิดชอบ';
    case DECISION_ACTION.UPDATE_JOB:
      return 'ใบงานไม่มีการอัปเดตเชิงปฏิบัติการตามรอบที่เหมาะสม';
    case DECISION_ACTION.CONTACT_CUSTOMER:
      return 'ใบงานรอการตัดสินใจจากลูกค้านานผิดปกติ';
    case DECISION_ACTION.FOLLOW_UP_PARTS:
      return 'ใบงานรออะไหล่นานและมีความเสี่ยงต่อเวลาส่งมอบ';
    case DECISION_ACTION.REVIEW_WARRANTY_CLAIM:
      return 'ใบงานมีรายการเคลมที่ยังไม่สิ้นสุด';
    case DECISION_ACTION.REVIEW_REPEAT_REPAIR:
      return 'ใบงานมีความสัมพันธ์กับงานซ่อมซ้ำและควรทบทวนสาเหตุ';
    case DECISION_ACTION.EXPEDITE_JOB:
      return riskCodes.includes('SLA_OVERDUE') ? 'ใบงานเกิน SLA แล้ว' : 'ใบงานใกล้เกิน SLA';
    case DECISION_ACTION.MONITOR:
      return `ใบงานสถานะ ${job.status} ยังดำเนินการตามปกติ`;
    default:
      return 'ไม่มีการดำเนินการเร่งด่วน';
  }
}

function buildOperationalDecision(job, now = new Date()) {
  const risks = buildJobOperationalRisks(job, now);
  const riskCodes = [...new Set(risks.map((item) => item.code))].sort();
  const action = actionForRiskCodes(riskCodes, job);
  const sla = buildSlaProjection(job, now);

  return {
    repairJobId: job.id,
    repairJobNo: job.jobNo || null,
    status: job.status,
    technicianId: job.technicianId || null,
    customerId: job.customerId || null,
    action,
    reason: buildDecisionReason(action, riskCodes, job),
    highestRiskLevel: highestRiskLevel(risks),
    riskCodes,
    riskCount: risks.length,
    sla: {
      thresholdHours: sla.thresholdHours,
      ageHours: sla.ageHours,
      overdue: sla.overdue,
      overdueHours: sla.overdueHours,
    },
  };
}

function buildManagerSummary(jobs, decisions, actionable) {
  const activeJobs = jobs.filter((job) => ACTIVE_STATUSES.has(job.status));
  const overdueJobs = decisions.filter((item) => item.sla.overdue);
  const atRiskJobs = decisions.filter((item) => item.riskCodes.includes('SLA_AT_RISK'));
  const unassignedJobs = decisions.filter((item) => item.action === DECISION_ACTION.ASSIGN_TECHNICIAN);
  const customerContactJobs = decisions.filter((item) => item.action === DECISION_ACTION.CONTACT_CUSTOMER);
  const partsFollowUpJobs = decisions.filter((item) => item.action === DECISION_ACTION.FOLLOW_UP_PARTS);
  const criticalJobs = actionable.filter((item) => item.highestRiskLevel === 'CRITICAL');
  const denominator = Math.max(activeJobs.length, 1);

  return {
    activeJobs: activeJobs.length,
    actionableJobs: actionable.length,
    criticalJobs: criticalJobs.length,
    overdueJobs: overdueJobs.length,
    slaAtRiskJobs: atRiskJobs.length,
    unassignedJobs: unassignedJobs.length,
    customerContactJobs: customerContactJobs.length,
    partsFollowUpJobs: partsFollowUpJobs.length,
    actionableRate: Number((actionable.length / denominator).toFixed(2)),
    slaOverdueRate: Number((overdueJobs.length / denominator).toFixed(2)),
    attention: criticalJobs.length > 0
      ? 'IMMEDIATE'
      : actionable.length > 0
        ? 'REQUIRED'
        : 'NORMAL',
    topActions: Object.entries(actionable.reduce((result, item) => {
      result[item.action] = (result[item.action] || 0) + 1;
      return result;
    }, {}))
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action))
      .slice(0, 5),
  };
}

function buildOperationalDecisionProjection(jobs, now = new Date()) {
  const decisions = jobs.map((job) => buildOperationalDecision(job, now));
  const actionable = decisions.filter((item) => ![DECISION_ACTION.NONE, DECISION_ACTION.MONITOR].includes(item.action));
  actionable.sort((a, b) => {
    const aPriority = a.highestRiskLevel == null ? 99 : RISK_PRIORITY[a.highestRiskLevel];
    const bPriority = b.highestRiskLevel == null ? 99 : RISK_PRIORITY[b.highestRiskLevel];
    return aPriority - bPriority || b.riskCount - a.riskCount || Number(a.repairJobId) - Number(b.repairJobId);
  });

  const counters = decisions.reduce((result, item) => {
    result.total += 1;
    result.byAction[item.action] = (result.byAction[item.action] || 0) + 1;
    if (![DECISION_ACTION.NONE, DECISION_ACTION.MONITOR].includes(item.action)) result.actionable += 1;
    return result;
  }, { total: 0, actionable: 0, byAction: {} });

  return {
    contractVersion: DECISION_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    counters,
    managerSummary: buildManagerSummary(jobs, decisions, actionable),
    priorityQueue: actionable,
    decisions,
  };
}

class RepairOperationalDecisionService {
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
    return buildOperationalDecisionProjection(jobs);
  }
}

module.exports = new RepairOperationalDecisionService();
module.exports.RepairOperationalDecisionService = RepairOperationalDecisionService;
module.exports.DECISION_CONTRACT_VERSION = DECISION_CONTRACT_VERSION;
module.exports.DECISION_ACTION = DECISION_ACTION;
module.exports.buildOperationalDecision = buildOperationalDecision;
module.exports.buildManagerSummary = buildManagerSummary;
module.exports.buildOperationalDecisionProjection = buildOperationalDecisionProjection;
