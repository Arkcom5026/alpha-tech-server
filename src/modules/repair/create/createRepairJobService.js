const { randomUUID } = require('crypto');
const repository = require('./createRepairJobRepository');
const { validateCreateRepairJob } = require('../validators/repairValidator');
const { RepairError, RepairFailureCode } = require('../contracts/repairError');
const {
  assertStockItemBranch,
  assertNoActiveRepair,
  assertNoActiveClaim,
  assertCustomerMatchesLatestSale,
} = require('../policies/repairIntakePolicy');
const { createRepairJobNo } = require('../utils/repairCode');
const { mapRepairJob } = require('../mappers/repairMapper');

const CUSTOMER_OVERRIDE_CAPABILITY = 'repair.customer-override';

function isPrismaUniqueConflict(error) {
  return error?.code === 'P2002';
}

function hasRepairCapability(actor, capability) {
  return Array.isArray(actor?.repairCapabilities)
    && actor.repairCapabilities.includes(capability);
}

function canOverrideCustomerOwnership(actor, payload) {
  return Boolean(
    payload?.allowCustomerOverride
    && hasRepairCapability(actor, CUSTOMER_OVERRIDE_CAPABILITY)
  );
}

function createRepairIntakeReference(branchId) {
  return `INT-${branchId}-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function assertRegisteredDeviceForIntake(device, actor, payload) {
  if (!device) {
    throw new RepairError(
      RepairFailureCode.DEVICE_NOT_FOUND,
      'ไม่พบอุปกรณ์เดิมที่เลือกสำหรับเปิดงานซ่อมใหม่',
      404
    );
  }

  if (Number(device.branchId) !== Number(actor.branchId)) {
    throw new RepairError(
      RepairFailureCode.DEVICE_BRANCH_MISMATCH,
      'อุปกรณ์นี้ไม่ได้อยู่ภายใต้สาขาของผู้ใช้งาน',
      403
    );
  }

  assertNoActiveRepair(device);
  assertNoActiveClaim(device);

  const ownerCustomerId = device.currentOwnerCustomerId || device.currentOwner?.id || null;
  if (
    ownerCustomerId &&
    Number(ownerCustomerId) !== Number(payload.customerId) &&
    !canOverrideCustomerOwnership(actor, payload)
  ) {
    throw new RepairError(
      RepairFailureCode.DEVICE_CUSTOMER_MISMATCH,
      'ลูกค้าที่นำอุปกรณ์มารับบริการไม่ตรงกับเจ้าของอุปกรณ์ปัจจุบัน กรุณาตรวจสอบก่อนเปิดงานใหม่',
      409,
      {
        expectedCustomerId: ownerCustomerId,
        providedCustomerId: payload.customerId,
      }
    );
  }
}

function buildDeviceSnapshot(device, stockItem, payload) {
  return {
    brand: device?.brand || stockItem?.product?.brand?.name || null,
    model: device?.model || payload.deviceModel || null,
    serialNumber: device?.serialNumber || stockItem?.serialNumber || null,
    imei: device?.imei || null,
    barcode: device?.barcode || stockItem?.barcode || null,
  };
}

class CreateRepairJobService {
  constructor(createRepository = repository) {
    this.repository = createRepository;
  }

  async execute(actor, rawPayload) {
    const payload = validateCreateRepairJob(rawPayload);

    const createAttempt = () =>
      this.repository.transaction(async (repo) => {
        const customer = await repo.findCustomer(actor.branchId, payload.customerId);
        if (!customer) {
          throw new RepairError(
            RepairFailureCode.CUSTOMER_NOT_FOUND,
            'ไม่พบข้อมูลลูกค้าที่เข้าถึงได้ในสาขานี้',
            404
          );
        }

        let stockItemId = payload.stockItemId || null;
        let deviceId = payload.deviceId || null;
        let intakeDevice = null;
        let intakeStockItem = null;

        if (payload.stockItemId) {
          const stockItem = await repo.findStockItemForIntake(payload.stockItemId);
          assertStockItemBranch(stockItem, actor.branchId);
          assertNoActiveRepair(stockItem);
          assertNoActiveClaim(stockItem);
          assertCustomerMatchesLatestSale(
            stockItem,
            payload.customerId,
            canOverrideCustomerOwnership(actor, payload)
          );

          intakeStockItem = stockItem;
          intakeDevice = stockItem.devices?.[0] || null;
          const stockDeviceId = intakeDevice?.id || null;
          if (payload.deviceId && stockDeviceId && Number(payload.deviceId) !== Number(stockDeviceId)) {
            throw new RepairError(
              RepairFailureCode.CONFLICT,
              'อุปกรณ์ที่เลือกไม่ตรงกับสินค้าที่ใช้เปิดงานซ่อม',
              409
            );
          }
          deviceId = stockDeviceId || payload.deviceId || null;
        } else if (payload.deviceId) {
          const device = await repo.findDeviceForIntake(payload.deviceId);
          assertRegisteredDeviceForIntake(device, actor, payload);
          intakeDevice = device;
          deviceId = device.id;
          stockItemId = device.stockItemId || null;
        }

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

        const created = await repo.create({
          jobNo: createRepairJobNo(actor.branchId),
          branchId: actor.branchId,
          customerId: payload.customerId,
          stockItemId,
          deviceId,
          deviceModel: payload.deviceModel,
          reportedSymptoms: payload.reportedSymptoms,
          technicianNotes: payload.technicianNotes,
          estimatedCost: payload.estimatedCost,
          depositPaid: payload.depositPaid,
          technicianId: payload.technicianId,
          status: 'RECEIVED',
        });

        let deviceIntake = null;
        if (
          created.deviceId &&
          actor.employeeId &&
          typeof repo.createDeviceIntake === 'function'
        ) {
          deviceIntake = await repo.createDeviceIntake({
            device: { connect: { id: created.deviceId } },
            branch: { connect: { id: created.branchId } },
            customer: { connect: { id: created.customerId } },
            receivedBy: { connect: { id: actor.employeeId } },
            repairJob: { connect: { id: created.id } },
            referenceNo: createRepairIntakeReference(created.branchId),
            assetDescription: created.deviceModel,
            customerProblem: created.reportedSymptoms,
            internalRemark: created.technicianNotes,
            status: 'LINKED_TO_REPAIR',
            receivedAt: created.createdAt,
            snapshot: {
              create: buildDeviceSnapshot(intakeDevice || created.device, intakeStockItem, payload),
            },
          });
        }

        const creationMetadata = {
          repairJobId: created.id,
          deviceIntakeId: deviceIntake?.id || null,
          jobNo: created.jobNo,
          customerId: created.customerId,
          stockItemId: created.stockItemId,
          deviceId: created.deviceId,
          status: created.status,
          deviceModel: created.deviceModel,
          preAgreedService: payload.preAgreedService || null,
          workflowTargetStatus: 'RECEIVED',
        };

        if (typeof repo.publishWorkflowEvent === 'function') {
          await repo.publishWorkflowEvent({
            repairJobId: created.id,
            branchId: created.branchId,
            eventType: 'REPAIR_CREATED',
            action: null,
            previousStatus: null,
            targetStatus: 'RECEIVED',
            eventKey: `repair-job:${created.id}:created`,
            correlationId: `repair-job:${created.id}`,
            causationId: null,
            title: `เปิดใบงานซ่อม ${created.jobNo}`,
            description: created.reportedSymptoms,
            actorEmployeeId: actor.employeeId || null,
            customerVisible: true,
            metadata: creationMetadata,
            occurredAt: created.createdAt,
          });
        }

        if (created.deviceId && typeof repo.publishPassportEvent === 'function') {
          await repo.publishPassportEvent({
            deviceId: created.deviceId,
            branchId: created.branchId,
            eventType: 'REPAIR_CREATED',
            sourceType: 'REPAIR_JOB',
            sourceId: String(created.id),
            eventKey: `repair-job:${created.id}:created`,
            correlationId: `repair-job:${created.id}`,
            title: `เปิดใบงานซ่อม ${created.jobNo}`,
            description: created.reportedSymptoms,
            actorEmployeeId: actor.employeeId || null,
            customerVisible: true,
            metadata: creationMetadata,
            occurredAt: created.createdAt,
          });
        }

        return mapRepairJob(created);
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
            'ไม่สามารถสร้างเลขใบงานซ่อมที่ไม่ซ้ำได้ กรุณาลองใหม่',
            409
          );
        }
        throw retryError;
      }
    }
  }
}

module.exports = new CreateRepairJobService();
module.exports.CreateRepairJobService = CreateRepairJobService;
module.exports.assertRegisteredDeviceForIntake = assertRegisteredDeviceForIntake;
module.exports.canOverrideCustomerOwnership = canOverrideCustomerOwnership;
module.exports.createRepairIntakeReference = createRepairIntakeReference;
