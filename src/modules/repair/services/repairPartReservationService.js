const crypto = require('crypto');
const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  assertRepairExecutionAuthorized,
} = require('../policies/repairExecutionAuthorizationPolicy');

const RESERVATION_ACTIONS = Object.freeze([
  'INSTALL',
  'RELEASE',
  'LOST',
  'DAMAGED',
]);
const TERMINAL_REPAIR_STATUSES = new Set([
  'COMPLETED',
  'RETURNED_TO_CUSTOMER',
  'CANCELLED',
]);

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  return metadata;
}

function partReservationHistory(metadata) {
  const history = metadataObject(metadata).repairPartReservations;
  return Array.isArray(history) ? history : [];
}

function positiveInt(value, fieldName) {
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

function optionalText(value, maxLength = 2000) {
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

function executionAuthorizationPayload(rawPayload = {}) {
  return {
    authorizationType: String(rawPayload.authorizationType || '')
      .trim()
      .toUpperCase(),
    reason: optionalText(rawPayload.authorizationReason),
  };
}

function validateReservation(payload = {}) {
  return {
    productId: positiveInt(payload.productId, 'productId'),
    quantity: positiveInt(payload.quantity, 'quantity'),
    note: optionalText(payload.note),
    ...executionAuthorizationPayload(payload),
  };
}

function validateReservationAction(payload = {}) {
  const action = String(payload.action || '').trim().toUpperCase();
  if (!RESERVATION_ACTIONS.includes(action)) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'action ไม่อยู่ในค่าที่ระบบรองรับ',
      400,
      { action, allowed: RESERVATION_ACTIONS }
    );
  }
  const reason = optionalText(payload.reason);
  if (['RELEASE', 'LOST', 'DAMAGED'].includes(action) && !reason) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'กรุณาระบุเหตุผลสำหรับการคืน สูญหาย หรือเสียหาย',
      400,
      { field: 'reason', action }
    );
  }
  return { action, reason };
}

class RepairPartReservationService {
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
    if (TERMINAL_REPAIR_STATUSES.has(job.status)) {
      throw new RepairError(
        RepairFailureCode.REPAIR_JOB_TERMINAL,
        'ไม่สามารถเปลี่ยนแปลงการจองอะไหล่ของใบงานที่สิ้นสุดแล้ว',
        409,
        { currentStatus: job.status }
      );
    }
    if (!job.serviceAssetId) {
      throw new RepairError(
        RepairFailureCode.SERVICE_ASSET_REQUIRED,
        'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนจองอะไหล่',
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
    const reservations = partReservationHistory(asset.metadata)
      .filter((item) => Number(item.repairJobId) === Number(job.id))
      .sort((a, b) => new Date(a.reservedAt) - new Date(b.reservedAt));
    return { repairJobId: job.id, repairJobNo: job.jobNo, reservations };
  }

  async reserve(actor, repairJobId, rawPayload) {
    const payload = validateReservation(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      assertRepairExecutionAuthorized({
        job,
        asset,
        authorizationType: payload.authorizationType,
        reason: payload.reason,
      });

      const product = await repo.findProduct(payload.productId);
      if (!product || !product.active) {
        throw new RepairError(
          RepairFailureCode.PART_PRODUCT_NOT_FOUND,
          'ไม่พบสินค้าอะไหล่ที่ใช้งานได้',
          404
        );
      }

      const stockBalance = await repo.findStockBalance(actor.branchId, payload.productId);
      const available = stockBalance ? Number(stockBalance.quantity) : 0;
      if (available < payload.quantity) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'จำนวนอะไหล่คงเหลือในสาขาไม่เพียงพอสำหรับการจอง',
          409,
          { available, requested: payload.quantity }
        );
      }

      const reserved = await repo.prisma.stockBalance.updateMany({
        where: {
          branchId: Number(actor.branchId),
          productId: Number(payload.productId),
          quantity: { gte: payload.quantity },
        },
        data: { quantity: { decrement: payload.quantity } },
      });
      if (reserved.count !== 1) {
        throw new RepairError(
          RepairFailureCode.PART_STOCK_INSUFFICIENT,
          'สต็อกอะไหล่ถูกใช้งานพร้อมกัน กรุณาตรวจสอบจำนวนคงเหลืออีกครั้ง',
          409,
          { requested: payload.quantity }
        );
      }

      const branchPrice = await repo.findBranchPrice(actor.branchId, payload.productId);
      const unitPrice = Number(
        branchPrice?.priceTechnician ??
          branchPrice?.priceRetail ??
          branchPrice?.costPrice ??
          stockBalance?.avgCost ??
          0
      );
      const reservedAt = new Date().toISOString();
      const reservation = {
        id: crypto.randomUUID(),
        repairJobId: job.id,
        repairJobNo: job.jobNo,
        productId: payload.productId,
        productName: product.name || null,
        quantity: payload.quantity,
        unitPrice,
        amount: Number((payload.quantity * unitPrice).toFixed(2)),
        status: 'RESERVED',
        note: payload.note,
        reservedByEmployeeId: actor.employeeId,
        reservedAt,
        resolvedByEmployeeId: null,
        resolvedAt: null,
        resolutionReason: null,
        installedPartItemId: null,
      };

      const metadata = metadataObject(asset.metadata);
      const history = partReservationHistory(metadata);
      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairPartReservations: [...history, reservation],
          latestRepairPartReservation: reservation,
        },
      });
      await repo.createStockMovement({
        productId: payload.productId,
        branchId: actor.branchId,
        qty: -payload.quantity,
        type: 'ADJUST',
        refType: 'REPAIR_JOB_PART_RESERVATION',
        refId: job.id,
        note: `จองอะไหล่สำหรับใบงานซ่อม ${job.jobNo}`,
        performedByEmployeeId: actor.employeeId,
      });
      return reservation;
    });
  }

  async resolve(actor, repairJobId, reservationId, rawPayload) {
    const payload = validateReservationAction(rawPayload);
    return this.repository.transaction(async (repo) => {
      const { job, asset, assetRepo } = await this.loadContext(repo, actor, repairJobId);
      const metadata = metadataObject(asset.metadata);
      const history = partReservationHistory(metadata);
      const index = history.findIndex(
        (item) =>
          item.id === reservationId &&
          Number(item.repairJobId) === Number(job.id)
      );
      if (index < 0) {
        throw new RepairError(
          RepairFailureCode.REPAIR_PART_NOT_FOUND,
          'ไม่พบรายการจองอะไหล่ของใบงานซ่อมนี้',
          404
        );
      }
      const current = history[index];
      if (current.status !== 'RESERVED') {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'รายการจองอะไหล่นี้ถูกดำเนินการแล้ว',
          409,
          { currentStatus: current.status }
        );
      }

      let installedPartItemId = null;
      if (payload.action === 'INSTALL') {
        if (!['IN_PROGRESS', 'WAITING_PARTS'].includes(job.status)) {
          throw new RepairError(
            RepairFailureCode.INVALID_REPAIR_TRANSITION,
            'ต้องเริ่มดำเนินงานซ่อมก่อนติดตั้งอะไหล่ที่จองไว้',
            409,
            { currentStatus: job.status }
          );
        }
        const part = await repo.createRepairPart({
          repairJobId: job.id,
          productId: current.productId,
          qtyUsed: current.quantity,
          unitPrice: current.unitPrice,
        });
        installedPartItemId = part.id;
      } else if (payload.action === 'RELEASE') {
        await repo.prisma.stockBalance.update({
          where: {
            productId_branchId: {
              productId: Number(current.productId),
              branchId: Number(actor.branchId),
            },
          },
          data: { quantity: { increment: Number(current.quantity) } },
        });
        await repo.createStockMovement({
          productId: current.productId,
          branchId: actor.branchId,
          qty: Number(current.quantity),
          type: 'ADJUST',
          refType: 'REPAIR_JOB_PART_RESERVATION_RELEASE',
          refId: job.id,
          note: `คืนอะไหล่ที่จองจากใบงานซ่อม ${job.jobNo}: ${payload.reason}`,
          performedByEmployeeId: actor.employeeId,
        });
      }

      const resolvedAt = new Date().toISOString();
      const updated = {
        ...current,
        status: payload.action === 'INSTALL' ? 'INSTALLED' : payload.action,
        installedPartItemId,
        resolutionReason: payload.reason,
        resolvedByEmployeeId: actor.employeeId,
        resolvedAt,
      };
      const next = [...history];
      next[index] = updated;
      await assetRepo.updateServiceAsset(asset.id, {
        metadata: {
          ...metadata,
          repairPartReservations: next,
          latestRepairPartReservation: updated,
        },
      });
      return updated;
    });
  }
}

module.exports = new RepairPartReservationService();
module.exports.RepairPartReservationService = RepairPartReservationService;
module.exports.RESERVATION_ACTIONS = RESERVATION_ACTIONS;
module.exports.partReservationHistory = partReservationHistory;
module.exports.validateReservation = validateReservation;
module.exports.validateReservationAction = validateReservationAction;
