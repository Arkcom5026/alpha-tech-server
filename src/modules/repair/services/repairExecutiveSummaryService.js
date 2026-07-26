const repairRepository = require('../repositories/repairRepository');
const {
  buildDailyManagementBrief,
} = require('./repairManagementBriefService');

const EXECUTIVE_SUMMARY_CONTRACT_VERSION = 'repair-executive-summary.v1';

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildHealthScore(kpis) {
  const penalty = (
    (kpis.criticalJobs * 20)
    + (kpis.overdueJobs * 12)
    + (kpis.unassignedJobs * 10)
    + (kpis.escalationJobs * 8)
    + Math.round(kpis.actionableRate * 20)
  );
  return clampScore(100 - penalty);
}

function buildHealthBand(score) {
  if (score >= 85) return 'HEALTHY';
  if (score >= 65) return 'WATCH';
  return 'CRITICAL';
}

function buildHealthDimensions(kpis) {
  return {
    slaHealth: clampScore(100 - Math.round(kpis.slaOverdueRate * 100)),
    workforceHealth: clampScore(Math.round(kpis.assignmentCoverageRate * 100)),
    executionHealth: clampScore(100 - Math.round(kpis.actionableRate * 100)),
    escalationHealth: clampScore(100 - Math.round(kpis.escalationRate * 100)),
  };
}

function buildPriorityFocus(brief) {
  const focus = [];
  const overview = brief.overview;

  if (overview.criticalJobs > 0) {
    focus.push({ code: 'RESOLVE_CRITICAL_JOBS', priority: 1, count: overview.criticalJobs, title: 'จัดการงานซ่อมวิกฤตทันที' });
  }
  if (overview.unassignedJobs > 0) {
    focus.push({ code: 'ASSIGN_TECHNICIANS', priority: 2, count: overview.unassignedJobs, title: 'มอบหมายช่างให้งานที่ยังไม่มีผู้รับผิดชอบ' });
  }
  if (overview.overdueJobs > 0) {
    focus.push({ code: 'RECOVER_SLA_OVERDUE', priority: 3, count: overview.overdueJobs, title: 'เร่งกู้คืนงานที่เกิน SLA' });
  }

  for (const item of brief.topActions) {
    if (focus.length >= 3) break;
    if (focus.some((entry) => entry.code === item.action)) continue;
    focus.push({ code: item.action, priority: focus.length + 1, count: item.count, title: `ดำเนินการ ${item.action}` });
  }

  if (focus.length === 0) {
    focus.push({ code: 'MAINTAIN_OPERATIONAL_HEALTH', priority: 1, count: 0, title: 'รักษาระดับการดำเนินงานปัจจุบัน' });
  }

  return focus.slice(0, 3);
}

function buildExecutiveNarrative(score, band, brief) {
  if (band === 'CRITICAL') {
    return `ภาพรวมงานซ่อมอยู่ในระดับวิกฤต คะแนนสุขภาพ ${score}/100 และต้องเร่งจัดการงานสำคัญทันที`;
  }
  if (band === 'WATCH') {
    return `ภาพรวมงานซ่อมต้องเฝ้าระวัง คะแนนสุขภาพ ${score}/100 และควรติดตามรายการที่ต้องดำเนินการ`;
  }
  return brief.attention === 'NORMAL'
    ? `ภาพรวมงานซ่อมอยู่ในเกณฑ์ดี คะแนนสุขภาพ ${score}/100`
    : `ภาพรวมงานซ่อมยังแข็งแรง คะแนนสุขภาพ ${score}/100 แต่มีบางรายการที่ควรติดตาม`;
}

function buildExecutiveSummaryProjection(jobs, now = new Date(), baseline = null) {
  const brief = buildDailyManagementBrief(jobs, now, baseline);
  const healthScore = buildHealthScore(brief.kpis);
  const healthBand = buildHealthBand(healthScore);

  return {
    contractVersion: EXECUTIVE_SUMMARY_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    healthScore,
    healthBand,
    narrative: buildExecutiveNarrative(healthScore, healthBand, brief),
    attention: brief.attention,
    headline: brief.headline,
    trend: brief.trend,
    dimensions: buildHealthDimensions(brief.kpis),
    kpis: brief.kpis,
    priorityFocus: buildPriorityFocus(brief),
    escalationQueue: brief.escalationQueue.slice(0, 5),
    alertDigest: brief.alertDigest.slice(0, 5),
  };
}

class RepairExecutiveSummaryService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getSummary(actor, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 200), 1), 500);
    const jobs = await this.repository.listRepairJobs(actor.branchId, {
      status: null,
      stockItemId: null,
      customerId: null,
      limit,
      offset: 0,
    });
    return buildExecutiveSummaryProjection(jobs);
  }
}

module.exports = new RepairExecutiveSummaryService();
module.exports.RepairExecutiveSummaryService = RepairExecutiveSummaryService;
module.exports.EXECUTIVE_SUMMARY_CONTRACT_VERSION = EXECUTIVE_SUMMARY_CONTRACT_VERSION;
module.exports.buildHealthScore = buildHealthScore;
module.exports.buildHealthBand = buildHealthBand;
module.exports.buildHealthDimensions = buildHealthDimensions;
module.exports.buildPriorityFocus = buildPriorityFocus;
module.exports.buildExecutiveNarrative = buildExecutiveNarrative;
module.exports.buildExecutiveSummaryProjection = buildExecutiveSummaryProjection;
