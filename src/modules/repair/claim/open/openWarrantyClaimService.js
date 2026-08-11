const openWarrantyClaimRepository = require('./openWarrantyClaimRepository');
const {
  validateOpenWarrantyClaim,
} = require('../../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../../contracts/repairError');
const {
  inferSourceSupplierId,
} = require('../../policies/repairIntakePolicy');
const {
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
} = require('../../policies/warrantyClaimPolicy');
const { createWarrantyClaimNo } = require('../../utils/repairCode');
const { mapWarrantyClaim } = require('../../mappers/repairMapper');

function isPrismaUniqueConflict(error) {
  return error && error.code === 'P2002';
}

function workflowStatusFromEvent(event) {
  return event?.metadata?.workflowTargetStatus || 'RECEIVED';
}

class OpenWarrantyClaimService {
  constructor(repository = openWarrantyClaimRepository) {
    this.repository = repository;
  }

  async execute(actor, repairJobId, rawPayload) {
    const payload = validateOpenWarrantyClaim(rawPayload);
    const normalizedRepairJobId = Number(repairJobId);

    if (!Number.isInteger(normalizedRepairJobId) || normalizedRepairJobId <= 0) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'repairJobId ไม่ถูกต้อง',
        400,
        { field: 'repairJobId' }
      );
    }

    const createAttempt = async () =>
      this.repository.transaction(async (repo) => {
        const job = await repo.findRepairJob(
          actor.branchId,
          normalizedRepairJobId
        );
        if (!job) {
          assertRepairCanOpenClaim(job, 'RECEIVED');
        }

        const workflowEvent = job.deviceId
          ? await repo.findLatestWorkflowEvent(actor.branchId, job.id, job.deviceId)
          : null;
        const workflowStatus = workflowStatusFromEvent(workflowEvent);

        assertRepairCanOpenClaim(job, workflowStatus);
        assertNoActiveClaimForJob(job);

        const activeSubcontract = typeof repo.findActiveSubcontract === 'function'
          ? await repo.findActiveSubcontract(job.id)
          : null;
        if (activeSubcontract) {
          throw new RepairError(
            RepairFailureCode.CONFLICT,
            'อุปกรณ์อยู่ระหว่างส่งซ่อมภายนอก กรุณารับเครื่องกลับก่อนเปิดรายการเคลม',
            409,
            {
              repairSubcontractId: Number(activeSubcontract.id),
              subcontractStatus: activeSubcontract.status,
              providerName: activeSubcontract.providerName || null,
            }
          );
        }

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
            stockItemId: job.stockItemId || null,
            deviceId: job.deviceId || null,
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
              workflowStatusAtHandoff: workflowStatus,
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
}

module.exports = new OpenWarrantyClaimService();
module.exports.OpenWarrantyClaimService = OpenWarrantyClaimService;
module.exports.isPrismaUniqueConflict = isPrismaUniqueConflict;
module.exports.workflowStatusFromEvent = workflowStatusFromEvent;
