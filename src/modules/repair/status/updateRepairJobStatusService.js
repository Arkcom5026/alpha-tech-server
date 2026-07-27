const repository = require('./updateRepairJobStatusRepository');
const {
  validateRepairStatusUpdate,
} = require('../validators/repairValidator');
const {
  RepairError,
  RepairFailureCode,
} = require('../contracts/repairError');
const {
  assertRepairTransition,
} = require('../policies/repairTransitionPolicy');
const { mapRepairJob } = require('../mappers/repairMapper');
const {
  buildStatusChangedEvent,
} = require('../customer-timeline/repairCustomerTimelinePolicy');

class UpdateRepairJobStatusService {
  constructor(statusRepository = repository) {
    this.repository = statusRepository;
  }

  async execute(actor, repairJobId, rawPayload) {
    const id = Number(repairJobId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new RepairError(
        RepairFailureCode.INVALID_INPUT,
        'repairJobId ต้องเป็นจำนวนเต็มมากกว่า 0',
        400,
        { field: 'repairJobId' }
      );
    }

    const payload = validateRepairStatusUpdate(rawPayload);

    return this.repository.transaction(async (repo) => {
      const job = await repo.findJob(actor.branchId, id);
      if (!job) {
        throw new RepairError(
          RepairFailureCode.REPAIR_JOB_NOT_FOUND,
          'ไม่พบใบงานซ่อมในสาขานี้',
          404
        );
      }

      assertRepairTransition(job.status, payload.status);

      if (payload.technicianId) {
        const technician = await repo.findTechnician(payload.technicianId);
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

      const updated = await repo.updateJob(job.id, {
        status: payload.status,
        ...(payload.technicianNotes !== null
          ? { technicianNotes: payload.technicianNotes }
          : {}),
        ...(payload.technicianId
          ? { technicianId: payload.technicianId }
          : {}),
      });

      await repo.createTimelineEvent(
        buildStatusChangedEvent({
          repairJobId: job.id,
          fromStatus: job.status,
          toStatus: payload.status,
          actor,
          internalNote: payload.technicianNotes,
        })
      );

      return mapRepairJob(updated);
    });
  }
}

module.exports = new UpdateRepairJobStatusService();
module.exports.UpdateRepairJobStatusService = UpdateRepairJobStatusService;
