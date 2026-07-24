const repairRepository = require('../repositories/repairRepository');
const {
  validateOpenWarrantyClaim,
  validateClaimStatusUpdate,
  validateListQuery,
} = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  inferSourceSupplierId,
} = require('../policies/repairIntakePolicy');
const {
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
  assertResolutionRequirements,
} = require('../policies/warrantyClaimPolicy');
const {
  assertClaimTransition,
} = require('../policies/repairTransitionPolicy');
const { createWarrantyClaimNo } = require('../utils/repairCode');
const { mapWarrantyClaim } = require('../mappers/repairMapper');

function isPrismaUniqueConflict(error) {
  return error && error.code === 'P2002';
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

class WarrantyClaimService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async openFromRepairJob(actor, repairJobId, rawPayload) {
    const payload = validateOpenWarrantyClaim(rawPayload);

    const createAttempt = async () =>
      this.repository.transaction(async (repo) => {
        const job = await repo.findRepairJob(actor.branchId, repairJobId);
        assertRepairCanOpenClaim(job);
        assertNoActiveClaimForJob(job);

        const sourceSupplierId = inferSourceSupplierId(job.stockItem);
        const selectedSupplierId = payload.supplierId || sourceSupplierId || null;

        if (payload.supplierId) {
          const supplier = await repo.findSupplier(payload.supplierId);
          if (
            !supplier ||
            !supplier.active ||
            Number(supplier.branchId) !== Number(actor.branchId)
          ) {
            throw new RepairError(
              RepairFailureCode.WARRANTY_SUPPLIER_NOT_FOUND,
              'ไม่พบผู้จำหน่ายที่ใช้งานได้ในสาขานี้',
              404
            );
          }

          if (
            sourceSupplierId &&
            Number(sourceSupplierId) !== Number(payload.supplierId)
          ) {
            throw new RepairError(
              RepairFailureCode.WARRANTY_SUPPLIER_MISMATCH,
              'ผู้จำหน่ายที่เลือกไม่ตรงกับแหล่งรับเข้าสินค้าตามประวัติ',
              409,
              {
                sourceSupplierId,
                selectedSupplierId: payload.supplierId,
              }
            );
          }
        }

        const claim = await repo.createWarrantyClaim(
          {
            branchId: actor.branchId,
            stockItemId: job.stockItemId,
            supplierId: selectedSupplierId,
            repairJobId: job.id,
            repairLinkState: 'LINKED_VERIFIED',
            claimNo: createWarrantyClaimNo(actor.branchId),
            status: 'DRAFT',
            reason: payload.reason,
            serviceProvider: payload.serviceProvider,
            externalClaimRef: payload.externalClaimRef,
            trackingNumber: payload.trackingNumber,
            createdByEmployeeId: actor.employeeId,
          },
          {
            status: 'DRAFT',
            note: payload.note || 'สร้างรายการเคลมจากใบงานซ่อม',
            performedByEmployeeId: actor.employeeId,
            metadata: {
              source: 'REPAIR_JOB',
              repairJobId: job.id,
              repairLinkState: 'LINKED_VERIFIED',
            },
          }
        );

        return mapWarrantyClaim(claim);
      });

    try {
      return await createAttempt();
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;
      try {
        return await createAttempt();
      } catch (retryError) {
        if (isPrismaUniqueConflict(retryError)) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'ไม่สามารถสร้างเลขที่เคลมที่ไม่ซ้ำได้ กรุณาลองใหม่',
            409
          );
        }
        throw retryError;
      }
    }
  }

  async getWarrantyClaim(actor, warrantyClaimId) {
    const claim = await this.repository.findWarrantyClaim(
      actor.branchId,
      warrantyClaimId
    );
    if (!claim) {
      throw new RepairError(
        RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND,
        'ไม่พบรายการเคลมในสาขานี้',
        404
      );
    }
    return mapWarrantyClaim(claim);
  }

  async listWarrantyClaims(actor, query) {
    const filters = validateListQuery(query);
    const claims = await this.repository.listWarrantyClaims(
      actor.branchId,
      filters
    );
    return claims.map(mapWarrantyClaim);
  }

  async updateStatus(actor, warrantyClaimId, rawPayload) {
    const payload = validateClaimStatusUpdate(rawPayload);
    assertResolutionRequirements(payload);

    return this.repository.transaction(async (repo) => {
      const claim = await repo.findWarrantyClaim(
        actor.branchId,
        warrantyClaimId
      );
      if (!claim) {
        throw new RepairError(
          RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND,
          'ไม่พบรายการเคลมในสาขานี้',
          404
        );
      }

      assertClaimTransition(claim.status, payload.status);

      if (payload.replacementStockItemId) {
        const replacement = await repo.findStockItemByIdForIntake(
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
      const updated = await repo.updateWarrantyClaim(
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

module.exports = new WarrantyClaimService();
module.exports.WarrantyClaimService = WarrantyClaimService;
