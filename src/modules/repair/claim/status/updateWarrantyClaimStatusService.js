const crypto = require('node:crypto');
const repository = require('./updateWarrantyClaimStatusRepository');
const { validateClaimStatusUpdate } = require('../../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');
const {
  assertResolutionRequirements,
} = require('../../policies/warrantyClaimPolicy');
const {
  assertClaimTransition,
} = require('../../policies/repairTransitionPolicy');
const { mapWarrantyClaim } = require('../../mappers/repairMapper');
const { resolveWarrantyClaimOutcome } = require('./warrantyClaimOutcomePolicy');

function positiveClaimId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RepairError(
      RepairFailureCode.INVALID_INPUT,
      'claimId ต้องเป็นจำนวนเต็มมากกว่า 0',
      400,
      { field: 'claimId' }
    );
  }
  return parsed;
}

function claimTimestampData(nextStatus, now) {
  switch (nextStatus) {
    case 'SUBMITTED': return { submittedAt: now };
    case 'RECEIVED_BY_PROVIDER': return { providerReceivedAt: now };
    case 'RESOLVED': return { resolvedAt: now, cancelledAt: null };
    case 'CANCELLED': return { cancelledAt: now };
    default: return {};
  }
}

function resolutionRequestHash(claimId, payload) {
  return crypto.createHash('sha256').update(JSON.stringify({
    claimId: Number(claimId),
    resolution: payload.resolution || null,
    replacementStockItemId: payload.replacementStockItemId || null,
    creditAmount: payload.creditAmount ?? null,
  })).digest('hex');
}

class UpdateWarrantyClaimStatusService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  async execute(actor, rawWarrantyClaimId, rawPayload) {
    const warrantyClaimId = positiveClaimId(rawWarrantyClaimId);
    const payload = validateClaimStatusUpdate(rawPayload);
    assertResolutionRequirements(payload);

    return this.repository.transaction(async (repo) => {
      const claim = await repo.findById(actor.branchId, warrantyClaimId);
      if (!claim) {
        throw new RepairError(RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND, 'ไม่พบรายการเคลมในสาขานี้', 404);
      }

      if (payload.expectedStatus && payload.expectedStatus !== claim.status) {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'สถานะเคลมถูกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนดำเนินการต่อ',
          409,
          { expectedStatus: payload.expectedStatus, actualStatus: claim.status }
        );
      }

      assertClaimTransition(claim.status, payload.status);

      let replacement = null;
      if (payload.replacementStockItemId) {
        replacement = await repo.findReplacementStockItem(payload.replacementStockItemId);
        if (!replacement || Number(replacement.branchId) !== Number(actor.branchId)) {
          throw new RepairError(RepairFailureCode.STOCK_ITEM_NOT_FOUND, 'ไม่พบสินค้าทดแทนในสาขานี้', 404);
        }
        if (replacement.status !== 'IN_STOCK') {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'สินค้าทดแทนรายการนี้ไม่พร้อมใช้งานแล้ว กรุณาเลือกสินค้าใหม่',
            409,
            { replacementStockItemId: replacement.id, status: replacement.status }
          );
        }
        if (claim.stockItemId && Number(claim.stockItemId) === Number(replacement.id)) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'สินค้าทดแทนต้องเป็นคนละรายการกับสินค้าที่ส่งเคลม',
            409,
            { replacementStockItemId: replacement.id }
          );
        }
      }

      const outcome = payload.status === 'RESOLVED'
        ? resolveWarrantyClaimOutcome(payload.resolution)
        : null;

      if (outcome?.consumeReplacementStockItem) {
        const changed = await repo.consumeReplacementStockItem({
          branchId: actor.branchId,
          stockItemId: replacement.id,
          claimId: claim.id,
          employeeId: actor.employeeId,
        });
        if (changed.count !== 1) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'สินค้าทดแทนถูกใช้งานไปแล้ว กรุณาโหลดข้อมูลและเลือกสินค้าใหม่',
            409,
            { replacementStockItemId: replacement.id }
          );
        }
      }

      if (claim.deviceId && outcome?.deviceStatus) {
        await repo.updateDeviceStatus(claim.deviceId, outcome.deviceStatus);
        await repo.publishPassportEvent({
          deviceId: claim.deviceId,
          branchId: actor.branchId,
          eventType: outcome.passportEventType,
          sourceType: 'WARRANTY_CLAIM',
          sourceId: String(claim.id),
          eventKey: `warranty-claim:${claim.id}:resolved`,
          correlationId: `warranty-claim:${claim.id}`,
          title: 'ปิดผลการเคลม',
          description: payload.resolutionNote || payload.note || `ผลการเคลม: ${payload.resolution}`,
          actorType: actor.employeeId ? 'EMPLOYEE' : 'SYSTEM',
          actorEmployeeId: actor.employeeId || null,
          customerVisible: true,
          metadata: {
            claimNo: claim.claimNo,
            resolution: payload.resolution,
            deviceStatus: outcome.deviceStatus,
            replacementStockItemId: payload.replacementStockItemId || null,
            creditAmount: payload.creditAmount ?? null,
          },
        });
      }

      const now = new Date();
      const updated = await repo.updateWithEvent(
        claim.id,
        {
          status: payload.status,
          ...claimTimestampData(payload.status, now),
          ...(payload.externalClaimRef !== null ? { externalClaimRef: payload.externalClaimRef } : {}),
          ...(payload.trackingNumber !== null ? { trackingNumber: payload.trackingNumber } : {}),
          ...(payload.serviceProvider !== null ? { serviceProvider: payload.serviceProvider } : {}),
          ...(payload.resolution ? { resolution: payload.resolution } : {}),
          ...(payload.resolutionNote !== null ? { resolutionNote: payload.resolutionNote } : {}),
          ...(payload.replacementStockItemId ? { replacementStockItemId: payload.replacementStockItemId } : {}),
          ...(payload.creditAmount !== null ? { creditAmount: payload.creditAmount } : {}),
          ...(payload.status === 'RESOLVED' ? { resolvedByEmployeeId: actor.employeeId } : {}),
        },
        {
          status: payload.status,
          note: payload.note,
          performedByEmployeeId: actor.employeeId,
          metadata: {
            previousStatus: claim.status,
            resolution: payload.resolution,
            replacementStockItemId: payload.replacementStockItemId || null,
            outcome: outcome ? {
              deviceStatus: outcome.deviceStatus,
              passportEventType: outcome.passportEventType,
              replacementConsumed: outcome.consumeReplacementStockItem,
            } : null,
          },
        }
      );

      if (payload.status === 'RESOLVED') {
        await repo.createCompletionCommand({
          branchId: Number(actor.branchId),
          commandKey: `warranty-claim:${claim.id}:resolved`,
          requestHash: resolutionRequestHash(claim.id, payload),
          warrantyClaimId: claim.id,
          completedAt: now,
        });
      }

      return mapWarrantyClaim(updated);
    });
  }
}

module.exports = new UpdateWarrantyClaimStatusService();
module.exports.UpdateWarrantyClaimStatusService = UpdateWarrantyClaimStatusService;
module.exports.positiveClaimId = positiveClaimId;
module.exports.claimTimestampData = claimTimestampData;
module.exports.resolutionRequestHash = resolutionRequestHash;
