const { randomUUID } = require('crypto');
const repository = require('./externalDeviceIntakeRepository');
const { validateExternalDeviceIntake } = require('./validateExternalDeviceIntake');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const { createRepairJobNo } = require('../utils/repairCode');
const { mapRepairJob } = require('../mappers/repairMapper');

function createExternalIntakeReference(branchId) {
  return `EXT-${branchId}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function createInternalDeviceBarcode(branchId) {
  return `DEV-${branchId}-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
}

class CreateExternalDeviceIntakeService {
  constructor(repo = repository) {
    this.repository = repo;
  }

  execute(actor, rawPayload) {
    const payload = validateExternalDeviceIntake(rawPayload);
    const deviceIdentity = {
      ...payload.device,
      barcode: payload.device.barcode || createInternalDeviceBarcode(actor.branchId),
    };

    return this.repository.transaction(async (repo) => {
      const customer = await repo.findCustomer(actor.branchId, payload.customerId);
      if (!customer) {
        throw new RepairError(
          RepairFailureCode.CUSTOMER_NOT_FOUND,
          'ไม่พบข้อมูลลูกค้าที่เข้าถึงได้ในสาขานี้',
          404
        );
      }

      const duplicate = await repo.findDeviceByIdentity(actor.branchId, deviceIdentity);
      if (duplicate) {
        throw new RepairError(
          RepairFailureCode.CONFLICT,
          'พบอุปกรณ์ที่ใช้ Barcode, Serial Number หรือ IMEI นี้อยู่แล้ว กรุณาค้นหาอุปกรณ์เดิม',
          409,
          { deviceId: duplicate.id }
        );
      }

      const occurredAt = new Date();
      const referenceNo = createExternalIntakeReference(actor.branchId);
      const device = await repo.createDevice({
        branchId: actor.branchId,
        currentOwnerCustomerId: payload.customerId,
        stockItemId: null,
        fingerprint: randomUUID(),
        category: payload.device.category,
        brand: payload.device.brand,
        model: payload.device.model,
        serialNumber: deviceIdentity.serialNumber,
        imei: deviceIdentity.imei,
        barcode: deviceIdentity.barcode,
        status: 'IN_REPAIR',
      });

      const repairJob = await repo.createRepairJob({
        jobNo: createRepairJobNo(actor.branchId),
        branchId: actor.branchId,
        customerId: payload.customerId,
        stockItemId: null,
        deviceId: device.id,
        deviceModel: [payload.device.brand, payload.device.model].filter(Boolean).join(' '),
        reportedSymptoms: payload.customerProblem,
        technicianNotes: payload.internalRemark,
        estimatedCost: payload.estimatedCost,
        depositPaid: payload.depositPaid,
        status: 'RECEIVED',
      });

      const intake = await repo.createDeviceIntake({
        device: { connect: { id: device.id } },
        branch: { connect: { id: actor.branchId } },
        customer: { connect: { id: payload.customerId } },
        receivedBy: { connect: { id: actor.employeeId } },
        repairJob: { connect: { id: repairJob.id } },
        referenceNo,
        customerProblem: payload.customerProblem,
        internalRemark: payload.internalRemark,
        status: 'LINKED_TO_REPAIR',
        receivedAt: occurredAt,
        snapshot: {
          create: {
            brand: payload.device.brand,
            model: payload.device.model,
            serialNumber: deviceIdentity.serialNumber,
            imei: deviceIdentity.imei,
            barcode: deviceIdentity.barcode,
            accessoriesSummary: payload.accessories
              .map((item) => `${item.accessoryType} x${item.quantity}`)
              .join(', ') || null,
          },
        },
        accessories: {
          create: payload.accessories,
        },
      });

      await repo.createOwnership({
        deviceId: device.id,
        customerId: payload.customerId,
        ownershipType: 'OWNER',
        sourceType: 'DEVICE_INTAKE',
        sourceId: String(intake.id),
        createdByEmployeeId: actor.employeeId,
        startedAt: occurredAt,
      });

      await repo.publishPassportEvent({
        deviceId: device.id,
        branchId: actor.branchId,
        eventType: 'REGISTERED',
        sourceType: 'DEVICE_INTAKE',
        sourceId: String(intake.id),
        eventKey: `device-intake:${intake.id}:registered`,
        correlationId: `repair-job:${repairJob.id}`,
        title: `ลงทะเบียนอุปกรณ์ภายนอก ${payload.device.model}`,
        description: payload.customerProblem,
        actorEmployeeId: actor.employeeId,
        customerVisible: true,
        metadata: {
          externalDevice: true,
          deviceIntakeId: intake.id,
          repairJobId: repairJob.id,
          referenceNo,
        },
        occurredAt,
      });

      await repo.publishPassportEvent({
        deviceId: device.id,
        branchId: actor.branchId,
        eventType: 'REPAIR_CREATED',
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJob.id),
        eventKey: `repair-job:${repairJob.id}:created`,
        correlationId: `repair-job:${repairJob.id}`,
        title: `เปิดใบงานซ่อม ${repairJob.jobNo}`,
        description: payload.customerProblem,
        actorEmployeeId: actor.employeeId,
        customerVisible: true,
        metadata: {
          repairJobId: repairJob.id,
          deviceIntakeId: intake.id,
          jobNo: repairJob.jobNo,
          status: repairJob.status,
          workflowTargetStatus: 'RECEIVED',
          externalDevice: true,
          preAgreedService: payload.preAgreedService || null,
        },
        occurredAt,
      });

      return {
        device,
        deviceIntake: intake,
        repairJob: mapRepairJob(repairJob),
        workflowStatus: 'RECEIVED',
        availableActions: [
          {
            action: 'QUEUE_DIAGNOSIS',
            targetStatus: 'WAITING_DIAGNOSIS',
          },
          ...(payload.preAgreedService
            ? [{ action: 'START_PRE_AGREED_SERVICE', targetStatus: 'APPROVED' }]
            : []),
        ],
        preAgreedService: payload.preAgreedService || null,
      };
    });
  }
}

module.exports = new CreateExternalDeviceIntakeService();
module.exports.CreateExternalDeviceIntakeService = CreateExternalDeviceIntakeService;
module.exports.createExternalIntakeReference = createExternalIntakeReference;
module.exports.createInternalDeviceBarcode = createInternalDeviceBarcode;
