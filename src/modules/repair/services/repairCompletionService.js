const repairRepository = require('../repositories/repairRepository');
const ServiceAssetRepository = require('../repositories/serviceAssetRepository');
const { validateRepairStatusUpdate } = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  assertRepairTransition,
} = require('../policies/repairTransitionPolicy');
const {
  assertRepairCanComplete,
} = require('../policies/repairCompletionPolicy');
const { buildCompletionReadiness } = require('./repairCompletionReadinessService');
const { mapRepairJob } = require('../mappers/repairMapper');

class RepairCompletionService {
  constructor(repository = repairRepository) {
    this.repository = repository;
  }

  async completeRepairJob(actor, repairJobId, rawPayload) {
    const payload = validateRepairStatusUpdate(rawPayload);

    if (payload.status !== 'COMPLETED') {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'RepairCompletionService รองรับเฉพาะสถานะ COMPLETED',
        400,
        { status: payload.status }
      );
    }

    return this.repository.transaction(async (repo) => {
      const job = await repo.findRepairJob(actor.branchId, repairJobId);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      assertRepairTransition(job.status, payload.status);
      assertRepairCanComplete(job);

      if (!job.serviceAssetId) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_REQUIRED,
          'ใบงานซ่อมต้องเชื่อมกับอุปกรณ์บริการก่อนปิดงาน',
          409
        );
      }
      const assetRepository = new ServiceAssetRepository(repo.prisma);
      const asset = await assetRepository.findServiceAsset(actor.branchId, job.serviceAssetId);
      if (!asset) {
        throw new RepairError(
          RepairFailureCode.SERVICE_ASSET_NOT_FOUND,
          'ไม่พบอุปกรณ์บริการของใบงานซ่อม',
          404
        );
      }
      const readiness = buildCompletionReadiness({ ...job, metadata: asset.metadata });
      if (!readiness.readyForCompletion) {
        throw new RepairError(
          RepairFailureCode.REPAIR_COMPLETION_READINESS_REQUIRED,
          'งานซ่อมยังไม่ผ่านรายการตรวจสอบก่อนปิดงาน',
          409,
          readiness.requirements
        );
      }

      if (payload.technicianId) {
        const technician = await repo.findEmployee(payload.technicianId);
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
      }

      const updated = await repo.updateRepairJob(job.id, {
        status: 'COMPLETED',
        ...(payload.technicianNotes !== null
          ? { technicianNotes: payload.technicianNotes }
          : {}),
        ...(payload.technicianId ? { technicianId: payload.technicianId } : {}),
      });

      return {
        repairJob: mapRepairJob(updated),
        completionReadiness: readiness,
      };
    });
  }
}

module.exports = new RepairCompletionService();
module.exports.RepairCompletionService = RepairCompletionService;
