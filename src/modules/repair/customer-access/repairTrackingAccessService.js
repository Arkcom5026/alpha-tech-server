const crypto = require('crypto');
const repository = require('./repairTrackingAccessRepository');
const { mapApproval } = require('../estimate-approval/repairEstimateApprovalPolicy');

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

function mapCustomerStatus(status) {
  const map = {
    RECEIVED: {
      code: 'RECEIVED',
      label: 'ร้านรับอุปกรณ์แล้ว',
      description: 'อุปกรณ์อยู่กับร้านและรอการตรวจสอบ',
      stage: 1,
    },
    IN_PROGRESS: {
      code: 'IN_PROGRESS',
      label: 'กำลังตรวจสอบหรือดำเนินการ',
      description: 'ช่างกำลังตรวจสอบหรือซ่อมอุปกรณ์',
      stage: 2,
    },
    WAITING_PARTS: {
      code: 'WAITING_PARTS',
      label: 'กำลังรออะไหล่',
      description: 'ร้านกำลังจัดเตรียมหรือรออะไหล่ที่จำเป็น',
      stage: 3,
    },
    COMPLETED: {
      code: 'READY',
      label: 'ดำเนินการเสร็จแล้ว',
      description: 'กรุณาติดต่อร้านเพื่อรับอุปกรณ์',
      stage: 4,
    },
    CANCELLED: {
      code: 'CANCELLED',
      label: 'ยุติการดำเนินงาน',
      description: 'รายการนี้ถูกยกเลิกหรือยุติแล้ว',
      stage: 0,
    },
  };

  return map[status] || {
    code: 'IN_PROGRESS',
    label: 'กำลังดำเนินการ',
    description: 'กรุณาติดต่อร้านหากต้องการข้อมูลเพิ่มเติม',
    stage: 2,
  };
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

function toPublicProjection(job) {
  const product = job.stockItem?.product;
  const intakeSnapshot = job.deviceIntake?.snapshot;
  const registeredDevice = job.device;
  const currentStatus = mapCustomerStatus(job.status);
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

  const timeline = [
    {
      type: 'RECEIVED',
      title: 'ร้านรับอุปกรณ์แล้ว',
      description: 'บันทึกรายการรับอุปกรณ์เข้าสู่ระบบเรียบร้อยแล้ว',
      occurredAt: job.deviceIntake?.receivedAt || job.createdAt,
    },
    ...publicEvents,
  ];

  if (job.updatedAt && new Date(job.updatedAt).getTime() !== new Date(job.createdAt).getTime()) {
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

  const projection = toPublicProjection(job);
  projection.repair.estimateApproval = mapApproval(
    await repository.getLatestEstimateApproval(access.repairJobId)
  );
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
  toPublicProjection,
};
