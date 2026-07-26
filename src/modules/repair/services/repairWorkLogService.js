const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const REPAIR_WORK_TYPES = Object.freeze([
  'DIAGNOSIS',
  'REPAIR',
  'PART_REPLACEMENT',
  'SOFTWARE',
  'TESTING',
  'CLEANING',
  'OTHER',
]);

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
}

function workLogHistory(metadata) {
  const history = metadataObject(metadata).repairWorkLogs;
  return Array.isArray(history) ? history : [];
}

function requiredText(value, fieldName, maxLength) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `กรุณาระบุ ${fieldName} ให้ถูกต้อง`,
      400,
      { field: fieldName, maxLength }
    );
  }
  return normalized;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (normalized.length > maxLength) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `ข้อความยาวเกิน ${maxLength} ตัวอักษร`,
      400
    );
  }
  return normalized || null;
}

function positiveInt(value, fieldName, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนเต็มมากกว่า 0`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function nonNegativeMoney(value, fieldName) {
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นจำนวนตั้งแต่ 0 ขึ้นไป`,
      400,
      { field: fieldName }
    );
  }
  return Number(parsed.toFixed(2));
}

function requiredDate(value, fieldName) {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นวันที่และเวลาที่ถูกต้อง`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function validateWorkLog(payload = {}) {
  const workType = requiredText(payload.workType, 'ประเภทงาน', 60).toUpperCase();
  if (!REPAIR_WORK_TYPES.includes(workType)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ประเภทงานไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { workType, allowed: REPAIR_WORK_TYPES }
    );
  }

  const startedAt = requiredDate(payload.startedAt, 'startedAt');
  const endedAt = requiredDate(payload.endedAt, 'endedAt');
  if (endedAt.getTime() <= startedAt.getTime()) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'endedAt ต้องอยู่หลัง startedAt',
      400,
      { startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString() }
    );
  }

  const durationMinutes = Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60000);
  if (durationMinutes > 24 * 60) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ระยะเวลาของ Work Log หนึ่งรายการต้องไม่เกิน 24 ชั่วโมง',
      400,
      { durationMinutes }
    );
  }

  return {
    workType,
    activity: requiredText(payload.activity, 'รายละเอียดงานที่ทำ', 4000),
    result: optionalText(payload.result, 4000),
    note: optionalText(payload.note, 4000),
    startedAt,
    endedAt,
    durationMinutes,
    hourlyLaborCost: nonNegativeMoney(payload.hourlyLaborCost, 'hourlyLaborCost'),
    technicianId: positiveInt(payload.technicianId, 'technicianId', true),
  };
}

function calculateLaborSummary(logs) {
  const totalMinutes = logs.reduce((sum, log) => sum + Number(log.durationMinutes || 0), 0);
  const actualLaborCost = logs.reduce((sum, log) => sum + Number(log.laborCost || 0), 0);
  return {
    entries: logs.length,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    actualLaborCost: Number(actualLaborCost.toFixed(2)),
    currency: 'THB',
  };
}

class RepairWorkLogService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async loadContext(repo, actor, repairJobId) {
    const job = await repo.findRepairJob(actor.branchId, repairJobId);
    if (!job) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_NOT_FOUND,
        'ไม่พบใบงานซ่อมในสาขานี้',
        404
      );
    }
    if (!job.serviceAssetId) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_REQUIRED,
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนบันทึก Work Log',
        409
      );
    }
    const assetRepo = new ServiceAssetRepository(repo.prisma);
    const asset = await assetRepo.findServiceAsset(actor.branchId, job.serviceAssetId);
    if (!asset) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
        'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
        404
      );
    }
    return { job, asset, assetRepo };
  }

  async listForRepairJob(actor, repairJobId) {
    const { job, asset } = await this.loadContext(this.repository, actor, repairJobId);
    const logs = workLogHistory(asset.metadata)
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
    return {
      repairJobId: job.id,
      repairJobNo: job.jobNo,
      logs,
      laborSummary: calculateLaborSummary(logs),
    };
  }

  async record(actor, repairJobId, rawPayload) {
    const payload = validateWorkLog(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      if (!['IN_PROGRESS', 'WAITING_PARTS'].includes(job.status)) {
        throw new RepairError(
          RepairFailureCode.INVALID_REPAIR_TRANSITION,
          'ต้องเริ่มดำเนินงานซ่อมก่อนบันทึก Work Log',
          409,
          { currentStatus: job.status, allowedStatuses: ['IN_PROGRESS', 'WAITING_PARTS'] }
        );
      }

      const technicianId = payload.technicianId || job.technicianId || actor.employeeId;
      const technician = await repo.findEmployee(technicianId);
      if (
        !technician ||
        Number(technician.branchId) !== Number(actor.branchId) ||
        !technician.active
      ) {
        throw new RepairError(
          RepairFailureCode.TECHNICIAN_NOT_FOUND,
          'ไม่พบช่างที่ใช้งานได้ในสาขานี้',
          404
        );
      }

      const metadata = metadataObject(asset.metadata);
      const history = workLogHistory(metadata);
      const laborCost = Number(
        ((payload.durationMinutes / 60) * payload.hourlyLaborCost).toFixed(2)
      );
      const workLog = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        workType: payload.workType,
        activity: payload.activity,
        result: payload.result,
        note: payload.note,
        startedAt: payload.startedAt.toISOString(),
        endedAt: payload.endedAt.toISOString(),
        durationMinutes: payload.durationMinutes,
        technicianId: technician.id,
        technicianName: technician.name || null,
        hourlyLaborCost: payload.hourlyLaborCost,
        laborCost,
        recordedByEmployeeId: actor.employeeId,
        recordedAt: new Date().toISOString(),
      };

      const nextHistory = [...history, workLog];
      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairWorkLogs: nextHistory,
          latestRepairWorkLog: workLog,
          repairLaborSummary: calculateLaborSummary(
            nextHistory.filter((item) => Number(item.repairJobId) === Number(job.id))
          ),
        },
      });

      return workLog;
    });
  }
}

module.exports = new RepairWorkLogService();
module.exports.RepairWorkLogService = RepairWorkLogService;
module.exports.REPAIR_WORK_TYPES = REPAIR_WORK_TYPES;
module.exports.workLogHistory = workLogHistory;
module.exports.calculateLaborSummary = calculateLaborSummary;
module.exports.validateWorkLog = validateWorkLog;
