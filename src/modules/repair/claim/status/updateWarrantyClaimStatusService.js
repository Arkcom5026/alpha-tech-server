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
    case 'SUBMITTED':
      return { submittedAt: now };
    case 'RECEIVED_BY_PROVIDER':
      return { providerReceivedAt: now };
    case 'RESOLVED':
      return { resolvedAt: now, cancelledAt: null };
    case 'CANCELLED':
      return { cancelledAt: now };
    default:
      return {};
  }
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
        throw new RepairError(
          RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND,
          'ไม่พบรายการเคลมในสาขานี้',
          404
        );
      }

      if (payload.expectedStatus && payload.expectedStatus !== claim.status) {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'สถานะเคลมถูกเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนดำเนินการต่อ',
          409,
          {
            expectedStatus: payload.expectedStatus,
            actualStatus: claim.status,
          }
        );
      }

      assertClaimTransition(claim.status, payload.status);

      if (payload.replacementStockItemId) {
        const replacement = await repo.findReplacementStockItem(
          payload.replacementStockItemId
        );
        if (
          !replacement ||
          Number(replacement.branchId) !== Number(actor.branchId)
        ) {
          throw new RepairError(
            RepairFailureCode.STOCK_ITEM_NOT_FOUND,
            'ไม่พบสินค้าทดแทนในสาขานี้',
            404
          );
        }
      }

      const now = new Date();
      const updated = await repo.updateWithEvent(
        claim.id,
        {
          status: payload.status,
          ...claimTimestampData(payload.status, now),
          ...(payload.externalClaimRef !== null
            ? { externalClaimRef: payload.externalClaimRef }
            : {}),
          ...(payload.trackingNumber !== null
            ? { trackingNumber: payload.trackingNumber }
            : {}),
          ...(payload.serviceProvider !== null
            ? { serviceProvider: payload.serviceProvider }
            : {}),
          ...(payload.resolution ? { resolution: payload.resolution } : {}),
          ...(payload.resolutionNote !== null
            ? { resolutionNote: payload.resolutionNote }
            : {}),
          ...(payload.replacementStockItemId
            ? { replacementStockItemId: payload.replacementStockItemId }
            : {}),
          ...(payload.creditAmount !== null
            ? { creditAmount: payload.creditAmount }
            : {}),
          ...(payload.status === 'RESOLVED'
            ? { resolvedByEmployeeId: actor.employeeId }
            : {}),
        },
        {
          status: payload.status,
          note: payload.note,
          performedByEmployeeId: actor.employeeId,
          metadata: {
            previousStatus: claim.status,
            resolution: payload.resolution,
          },
        }
      );

      return mapWarrantyClaim(updated);
    });
  }
}

module.exports = new UpdateWarrantyClaimStatusService();
module.exports.UpdateWarrantyClaimStatusService =
  UpdateWarrantyClaimStatusService;
module.exports.positiveClaimId = positiveClaimId;
module.exports.claimTimestampData = claimTimestampData;
