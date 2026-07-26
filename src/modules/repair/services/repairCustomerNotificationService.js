const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');

const NOTIFICATION_CHANNELS = Object.freeze([
  'PHONE',
  'SMS',
  'LINE',
  'EMAIL',
  'IN_PERSON',
  'OTHER',
]);

const NOTIFICATION_OUTCOMES = Object.freeze([
  'CONTACTED',
  'MESSAGE_SENT',
  'NO_ANSWER',
  'FAILED',
]);

const READY_FOR_PICKUP_OUTCOMES = new Set(['CONTACTED', 'MESSAGE_SENT']);

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
}

function notificationHistory(metadata) {
  const history = metadataObject(metadata).repairCustomerNotifications;
  return Array.isArray(history) ? history : [];
}

function requiredText(value, fieldName, maxLength = 2000) {
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

function optionalText(value, maxLength = 4000) {
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

function optionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      `${fieldName} ต้องเป็นวันที่และเวลาที่ถูกต้อง`,
      400,
      { field: fieldName }
    );
  }
  return parsed;
}

function validateNotification(payload = {}) {
  const channel = requiredText(payload.channel, 'ช่องทางการแจ้ง', 40).toUpperCase();
  if (!NOTIFICATION_CHANNELS.includes(channel)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ช่องทางการแจ้งไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { channel, allowed: NOTIFICATION_CHANNELS }
    );
  }

  const outcome = requiredText(payload.outcome, 'ผลการติดต่อ', 40).toUpperCase();
  if (!NOTIFICATION_OUTCOMES.includes(outcome)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'ผลการติดต่อไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { outcome, allowed: NOTIFICATION_OUTCOMES }
    );
  }

  return {
    channel,
    outcome,
    recipient: requiredText(payload.recipient, 'ผู้รับการแจ้งหรือปลายทาง', 255),
    messageSummary: requiredText(payload.messageSummary, 'สรุปข้อความที่แจ้ง', 2000),
    note: optionalText(payload.note),
    expectedPickupAt: optionalDate(payload.expectedPickupAt, 'expectedPickupAt'),
    externalReference: optionalText(payload.externalReference, 500),
  };
}

function buildNotificationProjection(job, asset, notifications) {
  const successful = notifications
    .filter((item) => READY_FOR_PICKUP_OUTCOMES.has(item.outcome))
    .sort((a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt));
  const latest = [...notifications].sort(
    (a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt)
  )[0] || null;
  const latestSuccessful = successful[0] || null;
  const handedOver = asset?.status === 'RETURNED_TO_CUSTOMER';

  return {
    repairJobId: job.id,
    repairJobNo: job.jobNo,
    repairStatus: job.status,
    serviceAssetStatus: asset?.status || null,
    handedOver,
    readyForPickup:
      job.status === 'COMPLETED' && !handedOver && Boolean(latestSuccessful),
    customerNotified: Boolean(latestSuccessful),
    latestNotification: latest,
    latestSuccessfulNotification: latestSuccessful,
    expectedPickupAt: handedOver
      ? null
      : latestSuccessful?.expectedPickupAt || null,
    notifications,
  };
}

class RepairCustomerNotificationService {
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
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนบันทึกการแจ้งลูกค้า',
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

  async getForRepairJob(actor, repairJobId) {
    const { job, asset } = await this.loadContext(this.repository, actor, repairJobId);
    const notifications = notificationHistory(asset.metadata)
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .sort((a, b) => new Date(a.notifiedAt) - new Date(b.notifiedAt));
    return buildNotificationProjection(job, asset, notifications);
  }

  async record(actor, repairJobId, rawPayload) {
    const payload = validateNotification(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      if (job.status !== 'COMPLETED') {
        throw new RepairError(
          RepairFailureCode.INVALID_REPAIR_TRANSITION,
          'ต้องปิดงานซ่อมเป็น COMPLETED ก่อนบันทึกการแจ้งพร้อมรับเครื่อง',
          409,
          { currentStatus: job.status, requiredStatus: 'COMPLETED' }
        );
      }
      if (asset.status === 'RETURNED_TO_CUSTOMER') {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_READY_FOR_HANDOVER,
          'ไม่สามารถบันทึกการแจ้งพร้อมรับเครื่องหลังส่งคืนเครื่องให้ลูกค้าแล้ว',
          409,
          { serviceAssetStatus: asset.status }
        );
      }

      const notifiedAt = new Date().toISOString();
      const notification = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        channel: payload.channel,
        outcome: payload.outcome,
        recipient: payload.recipient,
        messageSummary: payload.messageSummary,
        note: payload.note,
        expectedPickupAt: payload.expectedPickupAt
          ? payload.expectedPickupAt.toISOString()
          : null,
        externalReference: payload.externalReference,
        notifiedByEmployeeId: actor.employeeId,
        notifiedAt,
        readyForPickup: READY_FOR_PICKUP_OUTCOMES.has(payload.outcome),
      };

      const metadata = metadataObject(asset.metadata);
      const history = notificationHistory(metadata);
      const nextHistory = [...history, notification];
      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairCustomerNotifications: nextHistory,
          latestRepairCustomerNotification: notification,
          repairPickupReadiness: {
            repairJobId: job.id,
            readyForPickup: READY_FOR_PICKUP_OUTCOMES.has(payload.outcome),
            customerNotified: READY_FOR_PICKUP_OUTCOMES.has(payload.outcome),
            handedOver: false,
            expectedPickupAt: notification.expectedPickupAt,
            notificationId: notification.id,
            updatedAt: notifiedAt,
          },
        },
      });

      const notifications = nextHistory
        .filter((item) => Number(item.repairJobId) === Number(job.id))
        .sort((a, b) => new Date(a.notifiedAt) - new Date(b.notifiedAt));
      return buildNotificationProjection(job, asset, notifications);
    });
  }
}

module.exports = new RepairCustomerNotificationService();
module.exports.RepairCustomerNotificationService = RepairCustomerNotificationService;
module.exports.NOTIFICATION_CHANNELS = NOTIFICATION_CHANNELS;
module.exports.NOTIFICATION_OUTCOMES = NOTIFICATION_OUTCOMES;
module.exports.READY_FOR_PICKUP_OUTCOMES = READY_FOR_PICKUP_OUTCOMES;
module.exports.notificationHistory = notificationHistory;
module.exports.buildNotificationProjection = buildNotificationProjection;
module.exports.validateNotification = validateNotification;
