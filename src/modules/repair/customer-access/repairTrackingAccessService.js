const crypto = require('crypto');
const repository = require('./repairTrackingAccessRepository');
const { mapApproval } = require('../estimate-approval/repairEstimateApprovalPolicy');
const { mapHandover } = require('../handover/repairHandoverPolicy');
const {
  mapCustomerStatus,
  mapPersistedTimelineEvent,
} = require('../customer-timeline/repairCustomerTimelinePolicy');

const DEFAULT_EXPIRY_DAYS = 90;

function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function mapClaimStatus(claim) {
  if (!claim) return null;
  const completed = ['RESOLVED', 'CANCELLED', 'REJECTED'].includes(claim.status);
  return {
    claimNo: claim.claimNo,
    status: claim.status,
    label: completed ? 'ดำเนินการเคลมเสร็จสิ้น' : 'อยู่ระหว่างดำเนินการเคลม',
    serviceProvider: claim.serviceProvider || null,
    openedAt: claim.openedAt,
    lastUpdatedAt: claim.updatedAt,
  };
}

function mapWorkflowCustomerStatus(workflowStatus, legacyStatus) {
  if (workflowStatus === 'READY_FOR_DELIVERY') {
    return {
      code: 'READY',
      label: 'พร้อมรับเครื่อง',
      description: 'งานซ่อมและการตรวจ QC เสร็จแล้ว กรุณายืนยันการรับเครื่องเพื่อดำเนินการส่งมอบ',
      stage: 4,
    };
  }

  if (['DELIVERED', 'CLOSED'].includes(workflowStatus)) {
    return mapCustomerStatus('COMPLETED');
  }
  if (['CANCELLED', 'REJECTED'].includes(workflowStatus)) {
    return mapCustomerStatus('CANCELLED');
  }
  if (workflowStatus === 'WAITING_PARTS') {
    return mapCustomerStatus('WAITING_PARTS');
  }
  if (['RECEIVED', 'WAITING_DIAGNOSIS'].includes(workflowStatus)) {
    return mapCustomerStatus('RECEIVED');
  }
  if (workflowStatus) {
    return mapCustomerStatus('IN_PROGRESS');
  }
  return mapCustomerStatus(legacyStatus);
}

function toPublicProjection(job, persistedTimelineEvents = [], workflowStatus = null) {
  const product = job.stockItem?.product;
  const intakeSnapshot = job.deviceIntake?.snapshot;
  const registeredDevice = job.device;
  const currentStatus = mapWorkflowCustomerStatus(workflowStatus, job.status);
  const device = {
    displayName:
      product?.name ||
      [registeredDevice?.brand, registeredDevice?.model].filter(Boolean).join(' ') ||
      [intakeSnapshot?.brand, intakeSnapshot?.model].filter(Boolean).join(' ') ||
      job.deviceModel,
    model: registeredDevice?.model || intakeSnapshot?.model || job.deviceModel,
    brand: product?.brand?.name || registeredDevice?.brand || intakeSnapshot?.brand || null,
    type: product?.productType?.name || registeredDevice?.category || null,
    serialNumber:
      job.stockItem?.serialNumber ||
      registeredDevice?.serialNumber ||
      intakeSnapshot?.serialNumber ||
      null,
    imei: registeredDevice?.imei || intakeSnapshot?.imei || null,
    barcode:
      job.stockItem?.barcode ||
      registeredDevice?.barcode ||
      intakeSnapshot?.barcode ||
      null,
  };

  const publicEvents = (registeredDevice?.passportEvents || []).map((event) => ({
    type: event.eventType,
    title: event.title,
    description: event.description || null,
    occurredAt: event.occurredAt,
  }));

  const statusEvents = persistedTimelineEvents.map(mapPersistedTimelineEvent);
  const timeline = [
    {
      type: 'RECEIVED',
      title: 'ร้านรับอุปกรณ์แล้ว',
      description: 'บันทึกรายการรับอุปกรณ์เข้าสู่ระบบเรียบร้อยแล้ว',
      occurredAt: job.deviceIntake?.receivedAt || job.createdAt,
    },
    ...publicEvents,
    ...statusEvents,
  ].sort((left, right) => new Date(left.occurredAt) - new Date(right.occurredAt));

  if (
    statusEvents.length === 0 &&
    job.updatedAt &&
    new Date(job.updatedAt).getTime() !== new Date(job.createdAt).getTime()
  ) {
    timeline.push({
      type: currentStatus.code,
      title: currentStatus.label,
      description: currentStatus.description,
      occurredAt: job.updatedAt,
    });
  }

  return {
    contractVersion: 'repair-customer-tracking.v1',
    repair: {
      jobNo: job.jobNo,
      intakeReference: job.deviceIntake?.referenceNo || null,
      device,
      reportedSymptoms: job.reportedSymptoms,
      status: currentStatus,
      pickupDefaults: {
        receiverName: job.customer?.name || job.customer?.companyName || '',
      },
      estimate: {
        amount: Number(job.estimatedCost || 0),
        depositPaid: Number(job.depositPaid || 0),
        estimatedBalance: Math.max(
          Number(job.estimatedCost || 0) - Number(job.depositPaid || 0),
          0
        ),
        currency: 'THB',
      },
      accessories: (job.deviceIntake?.accessories || []).map((item) => ({
        type: item.accessoryType,
        quantity: item.quantity,
        remark: item.remark || null,
      })),
      claim: mapClaimStatus(job.warrantyClaims?.[0]),
      handover: mapHandover(job.delivery),
      timeline,
      receivedAt: job.deviceIntake?.receivedAt || job.createdAt,
      lastUpdatedAt: job.updatedAt,
    },
    branch: {
      name: job.branch?.name || null,
      phone: job.branch?.phone || null,
      address: job.branch?.address || null,
    },
  };
}

async function issue(actor, repairJobId, options = {}) {
  const job = await repository.findRepairJobForStaff(repairJobId, actor.branchId);
  if (!job) {
    throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
  }

  const expiryDays = Number(options.expiryDays || DEFAULT_EXPIRY_DAYS);
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 365) {
    throw createHttpError(400, 'INVALID_TRACKING_EXPIRY', 'expiryDays ต้องอยู่ระหว่าง 1 ถึง 365 วัน');
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  await repository.revokeActiveForJob(job.id);
  const access = await repository.create({
    repairJobId: job.id,
    tokenHash,
    expiresAt,
    createdByEmployeeId: actor.employeeId,
  });

  return {
    contractVersion: 'repair-tracking-access.v1',
    accessId: access.id,
    repairJobId: job.id,
    jobNo: job.jobNo,
    token: rawToken,
    expiresAt: access.expiresAt,
    trackingPath: `/repair/track/${rawToken}`,
  };
}

async function revoke(actor, repairJobId) {
  const job = await repository.findRepairJobForStaff(repairJobId, actor.branchId);
  if (!job) {
    throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบงานซ่อมในสาขาของพนักงาน');
  }

  const revokedCount = await repository.revokeActiveForJob(job.id);
  return { repairJobId: job.id, jobNo: job.jobNo, revokedCount };
}

async function getPublicTracking(token) {
  if (!token || typeof token !== 'string' || token.length < 32) {
    throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
  }

  const access = await repository.findValidByTokenHash(hashToken(token));
  if (!access) {
    throw createHttpError(404, 'TRACKING_ACCESS_NOT_FOUND', 'ลิงก์ติดตามงานไม่ถูกต้องหรือหมดอายุ');
  }

  const job = await repository.getPublicRepairProjection(access.repairJobId);
  if (!job) {
    throw createHttpError(404, 'REPAIR_JOB_NOT_FOUND', 'ไม่พบข้อมูลงานซ่อม');
  }

  const [timelineEvents, estimateApproval, workflowEvent] = await Promise.all([
    repository.listCustomerVisibleTimelineEvents(access.repairJobId),
    repository.getLatestEstimateApproval(access.repairJobId),
    repository.findLatestWorkflowEvent(job.id, job.deviceId, job.branchId),
  ]);
  const workflowStatus = workflowEvent?.metadata?.workflowTargetStatus || null;
  const projection = toPublicProjection(job, timelineEvents, workflowStatus);
  projection.repair.estimateApproval = mapApproval(estimateApproval);
  await repository.touch(access.id);
  return projection;
}

module.exports = {
  issue,
  rotate: issue,
  revoke,
  getPublicTracking,
  hashToken,
  mapCustomerStatus,
  mapWorkflowCustomerStatus,
  toPublicProjection,
};
