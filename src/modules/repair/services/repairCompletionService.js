const repairRepository = require('../repositories/repairRepository');
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

      return mapRepairJob(updated);
    });
  }
}

module.exports = new RepairCompletionService();
module.exports.RepairCompletionService = RepairCompletionService;
