const repairRepository = require('../repositories/repairRepository');
const {
  ACTIVE_STATUSES,
  buildSlaProjection,
  hoursBetween,
} = require('./repairOperationalIntelligenceService');

const OPERATIONAL_RISK_CONTRACT_VERSION = 'repair-operational-risk.v1';
const RISK_LEVEL = Object.freeze({
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
});
const RISK_PRIORITY = Object.freeze({ CRITICAL: 0, WARNING: 1, INFO: 2 });

function metadataObject(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function latestOperationalAt(job) {
  const metadata = metadataObject(job.metadata);
  const candidates = [
    job.updatedAt,
    metadata.lastOperationalUpdateAt,
    metadata.lastStatusChangedAt,
    metadata.lastCustomerContactAt,
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (!candidates.length) return job.createdAt || null;
  return candidates.sort((a, b) => b - a)[0].toISOString();
}

function riskItem(job, code, level, message, details = {}) {
  return {
    code,
    level,
    message,
    repairJobId: job.id,
    repairJobNo: job.jobNo || null,
    status: job.status,
    technicianId: job.technicianId || null,
    customerId: job.customerId || null,
    details,
  };
}

function buildJobOperationalRisks(job, now = new Date()) {
  const risks = [];
  const sla = buildSlaProjection(job, now);
  const lastOperationalAt = latestOperationalAt(job);
  const staleHours = lastOperationalAt ? hoursBetween(lastOperationalAt, now) : null;

  if (ACTIVE_STATUSES.has(job.status) && !job.technicianId) {
    risks.push(riskItem(job, 'UNASSIGNED_ACTIVE_JOB', RISK_LEVEL.CRITICAL, 'งานที่ยังดำเนินการอยู่แต่ยังไม่มีช่างรับผิดชอบ'));
  }

  if (ACTIVE_STATUSES.has(job.status) && staleHours != null && staleHours >= 48) {
    risks.push(riskItem(
      job,
      'STALE_OPERATIONAL_UPDATE',
      staleHours >= 96 ? RISK_LEVEL.CRITICAL : RISK_LEVEL.WARNING,
      'ใบงานไม่มีการอัปเดตเชิงปฏิบัติการเป็นเวลานาน',
      { lastOperationalAt, staleHours }
    ));
  }

  if (job.status === 'WAITING_APPROVAL' && sla.ageHours != null && sla.ageHours >= 48) {
    risks.push(riskItem(
      job,
      'APPROVAL_DELAY_RISK',
      sla.overdue ? RISK_LEVEL.CRITICAL : RISK_LEVEL.WARNING,
      'งานรอการอนุมัติจากลูกค้านานผิดปกติ',
      { ageHours: sla.ageHours, thresholdHours: sla.thresholdHours }
    ));
  }

  if (job.status === 'WAITING_PARTS' && sla.ageHours != null && sla.ageHours >= 120) {
    risks.push(riskItem(
      job,
      'PARTS_DELAY_RISK',
      sla.overdue ? RISK_LEVEL.CRITICAL : RISK_LEVEL.WARNING,
      'งานรออะไหล่นานและมีความเสี่ยงกระทบเวลาส่งมอบ',
      { ageHours: sla.ageHours, thresholdHours: sla.thresholdHours }
    ));
  }

  if (sla.thresholdHours != null && sla.ageHours != null) {
    const remainingHours = Number((sla.thresholdHours - sla.ageHours).toFixed(2));
    if (!sla.overdue && remainingHours >= 0 && remainingHours <= 12) {
      risks.push(riskItem(job, 'SLA_AT_RISK', RISK_LEVEL.WARNING, 'งานใกล้เกิน SLA', {
        remainingHours,
        thresholdHours: sla.thresholdHours,
        ageHours: sla.ageHours,
      }));
    }
    if (sla.overdue) {
      risks.push(riskItem(
        job,
        'SLA_OVERDUE',
        sla.overdueHours >= 48 ? RISK_LEVEL.CRITICAL : RISK_LEVEL.WARNING,
        'งานเกิน SLA แล้ว',
        { overdueHours: sla.overdueHours, thresholdHours: sla.thresholdHours, ageHours: sla.ageHours }
      ));
    }
  }

  const metadata = metadataObject(job.metadata);
  const repeatRepairLinks = Array.isArray(metadata.repeatRepairLinks) ? metadata.repeatRepairLinks : [];
  if (repeatRepairLinks.length > 0) {
    risks.push(riskItem(job, 'REPEAT_REPAIR_RISK', RISK_LEVEL.WARNING, 'ใบงานมีความสัมพันธ์กับงานซ่อมซ้ำ', {
      repeatRepairLinkCount: repeatRepairLinks.length,
    }));
  }

  const activeClaims = Array.isArray(job.warrantyClaims)
    ? job.warrantyClaims.filter((claim) => !['RESOLVED', 'REJECTED', 'CANCELLED'].includes(claim.status))
    : [];
  if (activeClaims.length > 0) {
    risks.push(riskItem(job, 'ACTIVE_WARRANTY_CLAIM_RISK', RISK_LEVEL.WARNING, 'ใบงานมีรายการเคลมที่ยังไม่สิ้นสุด', {
      activeClaimCount: activeClaims.length,
    }));
  }

  return risks;
}

function countBy(items, selector) {
  return items.reduce((result, item) => {
    const key = selector(item) || 'UNKNOWN';
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
}

function buildActionQueue(items) {
  const grouped = new Map();
  for (const item of items) {
    const key = Number(item.repairJobId);
    if (!grouped.has(key)) {
      grouped.set(key, {
        repairJobId: item.repairJobId,
        repairJobNo: item.repairJobNo,
        status: item.status,
        technicianId: item.technicianId,
        customerId: item.customerId,
        highestLevel: item.level,
        riskCodes: [],
        riskCount: 0,
      });
    }
    const row = grouped.get(key);
    row.riskCodes.push(item.code);
    row.riskCount += 1;
    if (RISK_PRIORITY[item.level] < RISK_PRIORITY[row.highestLevel]) row.highestLevel = item.level;
  }

  return [...grouped.values()]
    .map((row) => ({ ...row, riskCodes: [...new Set(row.riskCodes)].sort() }))
    .sort((a, b) => RISK_PRIORITY[a.highestLevel] - RISK_PRIORITY[b.highestLevel] || b.riskCount - a.riskCount || Number(a.repairJobId) - Number(b.repairJobId));
}

function buildHealthProjection(jobs, counters) {
  const activeJobs = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  const denominator = Math.max(activeJobs, 1);
  const penalty = Math.min(100, Math.round(((counters.critical * 20) + (counters.warning * 8) + (counters.info * 2)) / denominator));
  const score = Math.max(0, 100 - penalty);
  return {
    score,
    grade: score >= 85 ? 'HEALTHY' : score >= 60 ? 'WATCH' : 'AT_RISK',
    activeJobs,
    criticalRiskRate: Number((counters.critical / denominator).toFixed(2)),
    warningRiskRate: Number((counters.warning / denominator).toFixed(2)),
  };
}

function buildOperationalRiskProjection(jobs, now = new Date()) {
  const items = jobs.flatMap((job) => buildJobOperationalRisks(job, now));
  items.sort((a, b) => RISK_PRIORITY[a.level] - RISK_PRIORITY[b.level] || Number(a.repairJobId) - Number(b.repairJobId));

  const counters = {
    total: items.length,
    info: items.filter((item) => item.level === RISK_LEVEL.INFO).length,
    warning: items.filter((item) => item.level === RISK_LEVEL.WARNING).length,
    critical: items.filter((item) => item.level === RISK_LEVEL.CRITICAL).length,
    affectedJobs: new Set(items.map((item) => Number(item.repairJobId))).size,
  };

  return {
    contractVersion: OPERATIONAL_RISK_CONTRACT_VERSION,
    generatedAt: now.toISOString(),
    counters,
    health: buildHealthProjection(jobs, counters),
    breakdown: {
      byCode: countBy(items, (item) => item.code),
      byStatus: countBy(items, (item) => item.status),
      byLevel: countBy(items, (item) => item.level),
    },
    actionQueue: buildActionQueue(items),
    items,
  };
}

class RepairOperationalRiskService {
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
    return buildOperationalRiskProjection(jobs);
  }
}

module.exports = new RepairOperationalRiskService();
module.exports.RepairOperationalRiskService = RepairOperationalRiskService;
module.exports.OPERATIONAL_RISK_CONTRACT_VERSION = OPERATIONAL_RISK_CONTRACT_VERSION;
module.exports.RISK_LEVEL = RISK_LEVEL;
module.exports.RISK_PRIORITY = RISK_PRIORITY;
module.exports.latestOperationalAt = latestOperationalAt;
module.exports.buildJobOperationalRisks = buildJobOperationalRisks;
module.exports.buildActionQueue = buildActionQueue;
module.exports.buildHealthProjection = buildHealthProjection;
module.exports.buildOperationalRiskProjection = buildOperationalRiskProjection;