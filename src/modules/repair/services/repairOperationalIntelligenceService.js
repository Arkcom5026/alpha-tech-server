const repairRepository = require('../repositories/repairRepository');
const { buildTimeline } = require('./repairAssetTimelineService');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');

const ACTIVE_STATUSES = new Set(['RECEIVED', 'DIAGNOSING', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS']);
const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);
const AGING_BUCKETS = Object.freeze([
  { key: 'lt24h', min: 0, max: 24 },
  { key: 'h24to72', min: 24, max: 72 },
  { key: 'h72to168', min: 72, max: 168 },
  { key: 'gte168h', min: 168, max: Number.POSITIVE_INFINITY },
]);

function hoursBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  return Number(((endDate - startDate) / 3600000).toFixed(2));
}

function buildTimelineIntelligence(job, asset, now = new Date()) {
  const events = buildTimeline(job, asset);
  const firstEvent = events[0] || null;
  const lastEvent = events[events.length - 1] || null;
  const ageHours = firstEvent ? hoursBetween(firstEvent.occurredAt, now) : null;
  const elapsedHours = firstEvent && lastEvent
    ? hoursBetween(firstEvent.occurredAt, lastEvent.occurredAt)
    : null;
  const stageDurations = events.map((item, index) => {
    const next = events[index + 1];
    return {
      type: item.type,
      title: item.title,
      occurredAt: item.occurredAt,
      durationToNextHours: next ? hoursBetween(item.occurredAt, next.occurredAt) : null,
    };
  });

  return {
    eventCount: events.length,
    firstEvent,
    lastEvent,
    ageHours,
    elapsedHours,
    stageDurations,
  };
}

function slaThresholdHours(status) {
  switch (status) {
    case 'RECEIVED': return 24;
    case 'DIAGNOSING': return 48;
    case 'WAITING_APPROVAL': return 72;
    case 'IN_PROGRESS': return 120;
    case 'WAITING_PARTS': return 168;
    default: return null;
  }
}

function buildSlaProjection(job, now = new Date()) {
  const thresholdHours = slaThresholdHours(job.status);
  const ageHours = hoursBetween(job.createdAt, now);
  const overdueHours = thresholdHours == null || ageHours == null
    ? 0
    : Math.max(Number((ageHours - thresholdHours).toFixed(2)), 0);
  return {
    status: job.status,
    active: ACTIVE_STATUSES.has(job.status),
    terminal: TERMINAL_STATUSES.has(job.status),
    thresholdHours,
    ageHours,
    overdue: overdueHours > 0,
    overdueHours,
  };
}

function createStatusCounters(total) {
  return {
    total,
    active: 0,
    received: 0,
    diagnosing: 0,
    waitingApproval: 0,
    inProgress: 0,
    waitingParts: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0,
    unassigned: 0,
    warrantyRelated: 0,
    repeatRepair: 0,
  };
}

function incrementStatusCounter(counters, status) {
  switch (status) {
    case 'RECEIVED': counters.received += 1; break;
    case 'DIAGNOSING': counters.diagnosing += 1; break;
    case 'WAITING_APPROVAL': counters.waitingApproval += 1; break;
    case 'IN_PROGRESS': counters.inProgress += 1; break;
    case 'WAITING_PARTS': counters.waitingParts += 1; break;
    case 'COMPLETED': counters.completed += 1; break;
    case 'CANCELLED': counters.cancelled += 1; break;
    default: break;
  }
  if (ACTIVE_STATUSES.has(status)) counters.active += 1;
}

function agingBucket(ageHours) {
  if (ageHours == null) return null;
  return AGING_BUCKETS.find((bucket) => ageHours >= bucket.min && ageHours < bucket.max)?.key || null;
}

function hasWarrantyRelationship(job) {
  return Array.isArray(job.warrantyClaims) && job.warrantyClaims.length > 0;
}

function hasRepeatRepairMarker(job) {
  const metadata = job.metadata && typeof job.metadata === 'object' && !Array.isArray(job.metadata)
    ? job.metadata
    : {};
  const links = Array.isArray(metadata.repeatRepairLinks) ? metadata.repeatRepairLinks : [];
  return links.some(
    (link) => Number(link.repairJobId) === Number(job.id) || Number(link.previousRepairJobId) === Number(job.id)
  );
}

function buildTechnicianProjection(jobs, now = new Date()) {
  const groups = new Map();
  for (const job of jobs) {
    const technicianId = job.technicianId ? Number(job.technicianId) : null;
    const key = technicianId == null ? 'UNASSIGNED' : String(technicianId);
    if (!groups.has(key)) {
      groups.set(key, {
        technicianId,
        technicianName: job.technician?.displayName || job.technician?.name || null,
        counters: createStatusCounters(0),
        overdueJobs: [],
      });
    }
    const projection = groups.get(key);
    projection.counters.total += 1;
    incrementStatusCounter(projection.counters, job.status);
    const sla = buildSlaProjection(job, now);
    if (sla.overdue) {
      projection.counters.overdue += 1;
      projection.overdueJobs.push({
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        status: job.status,
        overdueHours: sla.overdueHours,
      });
    }
  }
  return [...groups.values()]
    .map((item) => ({
      ...item,
      overdueJobs: item.overdueJobs.sort((a, b) => b.overdueHours - a.overdueHours),
    }))
    .sort((a, b) => b.counters.active - a.counters.active || b.counters.overdue - a.counters.overdue);
}

function buildDashboardProjection(jobs, now = new Date()) {
  const counters = createStatusCounters(jobs.length);
  const overdueJobs = [];
  const aging = Object.fromEntries(AGING_BUCKETS.map((bucket) => [bucket.key, 0]));

  for (const job of jobs) {
    incrementStatusCounter(counters, job.status);
    if (!job.technicianId && ACTIVE_STATUSES.has(job.status)) counters.unassigned += 1;
    if (hasWarrantyRelationship(job)) counters.warrantyRelated += 1;
    if (hasRepeatRepairMarker(job)) counters.repeatRepair += 1;

    const sla = buildSlaProjection(job, now);
    const bucket = agingBucket(sla.ageHours);
    if (bucket) aging[bucket] += 1;
    if (sla.overdue) {
      counters.overdue += 1;
      overdueJobs.push({
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        status: job.status,
        customerId: job.customerId,
        technicianId: job.technicianId,
        overdueHours: sla.overdueHours,
        ageHours: sla.ageHours,
      });
    }
  }

  overdueJobs.sort((a, b) => b.overdueHours - a.overdueHours);
  return {
    generatedAt: now.toISOString(),
    counters,
    aging,
    overdueJobs,
    technicians: buildTechnicianProjection(jobs, now),
  };
}

class RepairOperationalIntelligenceService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async getJobIntelligence(actor, repairJobId) {
    const job = await this.repository.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(RepairFailureCode.REPAIR_JOB_NOT_FOUND, 'ไม่พบใบงานซ่อมในสาขานี้', 404);
    }
    if (!job.serviceAssetId) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_REQUIRED, 'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการ', 409);
    }
    const asset = await this.repository.prisma.serviceAsset.findFirst({
      where: { id: Number(job.serviceAssetId), branchId: Number(actor.branchId) },
    });
    if (!asset) {
      throw new RepairError(RepairFailureCode.SERVICE_ASSET_NOT_FOUND, 'ไม่พบอุปกรณ์บริการของใบงานซ่อม', 404);
    }
    return {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      timeline: buildTimelineIntelligence(job, asset),
      sla: buildSlaProjection(job),
    };
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
    return buildDashboardProjection(jobs);
  }
}

module.exports = new RepairOperationalIntelligenceService();
module.exports.RepairOperationalIntelligenceService = RepairOperationalIntelligenceService;
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
module.exports.TERMINAL_STATUSES = TERMINAL_STATUSES;
module.exports.AGING_BUCKETS = AGING_BUCKETS;
module.exports.hoursBetween = hoursBetween;
module.exports.slaThresholdHours = slaThresholdHours;
module.exports.agingBucket = agingBucket;
module.exports.buildTimelineIntelligence = buildTimelineIntelligence;
module.exports.buildSlaProjection = buildSlaProjection;
module.exports.buildTechnicianProjection = buildTechnicianProjection;
module.exports.buildDashboardProjection = buildDashboardProjection;
