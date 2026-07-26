const crypto = require('crypto');
const repository = require('./repairTrackingAccessRepository');

const DEFAULT_EXPIRY_DAYS = 90;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
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
      stage: 1,
    },
    IN_PROGRESS: {
      code: 'IN_PROGRESS',
      label: 'กำลังตรวจสอบหรือดำเนินการ',
      stage: 2,
    },
    WAITING_PARTS: {
      code: 'WAITING_PARTS',
      label: 'กำลังรออะไหล่',
      stage: 3,
    },
    COMPLETED: {
      code: 'READY',
      label: 'ดำเนินการเสร็จแล้ว กรุณาติดต่อร้าน',
      stage: 4,
    },
    CANCELLED: {
      code: 'CANCELLED',
      label: 'ยุติการดำเนินงาน',
      stage: 0,
    },
  };

  return map[status] || {
    code: 'IN_PROGRESS',
    label: 'กำลังดำเนินการ',
    stage: 2,
  };
}

function toPublicProjection(job) {
  const product = job.stockItem?.product;
  return {
    contractVersion: 'repair-customer-tracking.v1',
    repair: {
      jobNo: job.jobNo,
      device: {
        displayName: product?.name || job.deviceModel,
        model: job.deviceModel,
        brand: product?.brand?.name || null,
        type: product?.productType?.name || null,
        serialNumber: job.stockItem?.serialNumber || null,
        barcode: job.stockItem?.barcode || null,
      },
      reportedSymptoms: job.reportedSymptoms,
      status: mapCustomerStatus(job.status),
      estimate: {
        amount: Number(job.estimatedCost || 0),
        currency: 'THB',
      },
      receivedAt: job.createdAt,
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

  await repository.touch(access.id);
  return toPublicProjection(job);
}

module.exports = {
  issue,
  rotate: issue,
  revoke,
  getPublicTracking,
};
