const repository = require('./repairHandoverRepository');
const trackingRepository = require('../customer-access/repairTrackingAccessRepository');
const { hashToken } = require('../customer-access/repairTrackingAccessService');
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
  if (existing?.status === 'DELIVERED') return mapHandover(existing);
  const workflowStatus = await workflowStatusFor(job);
  const input = validateCustomerConfirmation(workflowStatus, payload);
  const delivery = await repository.confirmCustomer(job.id, input);
  await trackingRepository.touch(access.id);
  return mapHandover(delivery);
}

async function getStaff(actor, repairJobId) {
  const job = await repository.findJob(repairJobId, actor.branchId);
  if (!job) throw notFound();
  const handover = mapHandover(await repository.findDelivery(job.id));
  return {
    ...handover,
    workflowStatus: await workflowStatusFor(job),
  };
}

async function finalize(actor, repairJobId, payload) {
  const job = await repository.findJob(repairJobId, actor.branchId);
  if (!job) throw notFound();
  let delivery = await repository.findDelivery(job.id);
  if (delivery?.status === 'DELIVERED') {
    return { ...mapHandover(delivery), workflowStatus: 'DELIVERED' };
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

  const snapshot = {
    contractVersion: 'repair-handover.v3',
    jobNo: job.jobNo, branchId: job.branchId, customerId: job.customerId,
    deviceId: job.deviceId, customerConfirmedBy: delivery.customerConfirmedBy,
    customerConfirmedAt: delivery.customerConfirmedAt,
    estimatedCost: Number(job.estimatedCost || 0),
    depositPaid: Number(job.depositPaid || 0),
    accessories: job.deviceIntake?.accessories || [],
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
  return { ...mapHandover(finalized), workflowStatus: 'DELIVERED' };
}

module.exports = { confirmPublic, getStaff, finalize, workflowStatusFor };
