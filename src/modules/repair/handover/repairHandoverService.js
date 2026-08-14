const repository = require('./repairHandoverRepository');
const trackingRepository = require('../customer-access/repairTrackingAccessRepository');
const { hashToken } = require('../customer-access/repairTrackingAccessService');
const { mapRepairAsset } = require('../mappers/repairMapper');
const {
  validateCustomerConfirmation,
  validateFinalization,
  mapHandover,
} = require('./repairHandoverPolicy');

function notFound() {
  const error = new Error('ไม่พบงานซ่อม');
  error.statusCode = 404; error.status = 404; error.code = 'REPAIR_JOB_NOT_FOUND'; error.isOperational = true;
  return error;
}

function subcontractHold(activeSubcontract) {
  const error = new Error('อุปกรณ์ยังอยู่ระหว่างส่งซ่อมภายนอก กรุณารับเครื่องกลับเข้าร้านก่อนส่งมอบลูกค้า');
  error.statusCode = 409;
  error.status = 409;
  error.code = 'REPAIR_ACTIVE_SUBCONTRACT_HOLD';
  error.details = activeSubcontract
    ? {
        repairSubcontractId: Number(activeSubcontract.id),
        subcontractStatus: activeSubcontract.status,
        providerName: activeSubcontract.providerName || null,
      }
    : undefined;
  error.isOperational = true;
  return error;
}

function newestWorkflowEvent(left, right) {
  if (!left) return right || null;
  if (!right) return left;
  const leftTime = new Date(left.occurredAt || 0).getTime();
  const rightTime = new Date(right.occurredAt || 0).getTime();
  return rightTime > leftTime ? right : left;
}

async function workflowStatusFor(job) {
  const event = await repository.findLatestWorkflowEvent(job.id, job.deviceId, job.branchId);
  return event?.metadata?.workflowTargetStatus || 'RECEIVED';
}

async function confirmPublic(token, payload) {
  const access = await trackingRepository.findValidByTokenHash(hashToken(token || ''));
  if (!access) throw notFound();
  const job = await repository.findJob(access.repairJobId);
  if (!job) throw notFound();
  const existing = await repository.findDelivery(job.id);
  if (existing?.status === 'DELIVERED') {
    return { ...mapHandover(existing), repairAsset: mapRepairAsset(job) };
  }
  const activeSubcontract = typeof repository.findActiveSubcontract === 'function'
    ? await repository.findActiveSubcontract(job.id)
    : null;
  if (activeSubcontract) throw subcontractHold(activeSubcontract);
  const workflowStatus = await workflowStatusFor(job);
  const input = validateCustomerConfirmation(workflowStatus, payload);
  const delivery = await repository.confirmCustomer(job.id, input);
  await trackingRepository.touch(access.id);
  return { ...mapHandover(delivery), repairAsset: mapRepairAsset(job) };
}

async function getStaff(actor, repairJobId) {
  // Start all branch-safe reads together. RepairWorkflowEvent is the current
  // workflow authority, while Device Passport remains a compatibility
  // projection that can still be newer for historical paths.
  const jobPromise = repository.findJob(repairJobId, actor.branchId);
  const deliveryPromise = repository.findDelivery(repairJobId);
  const activeSubcontractPromise = typeof repository.findActiveSubcontract === 'function'
    ? repository.findActiveSubcontract(repairJobId)
    : Promise.resolve(null);
  const repairOwnedEventPromise = typeof repository.findLatestRepairOwnedWorkflowEvent === 'function'
    ? repository.findLatestRepairOwnedWorkflowEvent(repairJobId, actor.branchId)
    : Promise.resolve(null);

  const [job, delivery, activeSubcontract, repairOwnedEvent] = await Promise.all([
    jobPromise,
    deliveryPromise,
    activeSubcontractPromise,
    repairOwnedEventPromise,
  ]);
  if (!job) throw notFound();

  let workflowEvent = repairOwnedEvent;
  if (job.deviceId && typeof repository.findLatestPassportWorkflowEvent === 'function') {
    const passportEvent = await repository.findLatestPassportWorkflowEvent(
      job.id,
      job.deviceId,
      job.branchId
    );
    workflowEvent = newestWorkflowEvent(workflowEvent, passportEvent);
  } else if (!workflowEvent) {
    workflowEvent = await repository.findLatestWorkflowEvent(job.id, job.deviceId, job.branchId);
  }

  return {
    ...mapHandover(delivery),
    repairAsset: mapRepairAsset(job),
    workflowStatus: workflowEvent?.metadata?.workflowTargetStatus || 'RECEIVED',
    subcontractHold: activeSubcontract
      ? {
          repairSubcontractId: Number(activeSubcontract.id),
          status: activeSubcontract.status,
          providerName: activeSubcontract.providerName || null,
        }
      : null,
  };
}

async function finalize(actor, repairJobId, payload) {
  const job = await repository.findJob(repairJobId, actor.branchId);
  if (!job) throw notFound();
  const activeSubcontract = typeof repository.findActiveSubcontract === 'function'
    ? await repository.findActiveSubcontract(job.id)
    : null;
  if (activeSubcontract) throw subcontractHold(activeSubcontract);
  let delivery = await repository.findDelivery(job.id);
  if (delivery?.status === 'DELIVERED') {
    return { ...mapHandover(delivery), repairAsset: mapRepairAsset(job), workflowStatus: 'DELIVERED' };
  }
  const workflowStatus = await workflowStatusFor(job);
  const input = validateFinalization(workflowStatus, delivery, payload);

  if (!delivery?.customerConfirmedAt && input.receiverName) {
    delivery = await repository.confirmCustomer(job.id, {
      receiverName: input.receiverName,
      receiverPhone: input.receiverPhone,
      note: input.note,
    });
  }

  const repairAsset = mapRepairAsset(job);
  const snapshot = {
    contractVersion: 'repair-handover.v4',
    jobNo: job.jobNo, branchId: job.branchId, customerId: job.customerId,
    deviceId: job.deviceId, customerConfirmedBy: delivery.customerConfirmedBy,
    customerConfirmedAt: delivery.customerConfirmedAt,
    estimatedCost: Number(job.estimatedCost || 0),
    depositPaid: Number(job.depositPaid || 0),
    accessories: job.deviceIntake?.accessories || [],
    repairAsset,
    workflowPreviousStatus: workflowStatus,
    workflowTargetStatus: 'DELIVERED',
    confirmationMode: input.receiverName ? 'STAFF_COUNTER' : 'CUSTOMER_PUBLIC',
    checks: { paymentConfirmed: true, deviceReturned: true, accessoriesReturned: true },
  };
  const finalized = await repository.finalize(job.id, actor.employeeId, input, snapshot);
  if (!finalized) {
    const error = new Error('ไม่สามารถยืนยันการส่งมอบได้ กรุณาโหลดข้อมูลใหม่');
    error.statusCode = 409; error.status = 409; error.code = 'REPAIR_HANDOVER_STATE_CHANGED'; error.isOperational = true;
    throw error;
  }
  return { ...mapHandover(finalized), repairAsset, workflowStatus: 'DELIVERED' };
}

module.exports = { confirmPublic, getStaff, finalize, workflowStatusFor, subcontractHold, newestWorkflowEvent };
