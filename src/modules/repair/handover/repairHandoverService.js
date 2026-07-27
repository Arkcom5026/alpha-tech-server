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

async function confirmPublic(token, payload) {
  const access = await trackingRepository.findValidByTokenHash(hashToken(token || ''));
  if (!access) throw notFound();
  const job = await repository.findJob(access.repairJobId);
  if (!job) throw notFound();
  const input = validateCustomerConfirmation(job, payload);
  const existing = await repository.findDelivery(job.id);
  if (existing?.status === 'DELIVERED') return mapHandover(existing);
  const delivery = await repository.confirmCustomer(job.id, input);
  await trackingRepository.touch(access.id);
  return mapHandover(delivery);
}

async function getStaff(actor, repairJobId) {
  const job = await repository.findJob(repairJobId, actor.branchId);
  if (!job) throw notFound();
  return mapHandover(await repository.findDelivery(job.id));
}

async function finalize(actor, repairJobId, payload) {
  const job = await repository.findJob(repairJobId, actor.branchId);
  if (!job) throw notFound();
  const delivery = await repository.findDelivery(job.id);
  if (delivery?.status === 'DELIVERED') return mapHandover(delivery);
  const input = validateFinalization(job, delivery, payload);
  const snapshot = {
    contractVersion: 'repair-handover.v1',
    jobNo: job.jobNo, branchId: job.branchId, customerId: job.customerId,
    deviceId: job.deviceId, customerConfirmedBy: delivery.customerConfirmedBy,
    customerConfirmedAt: delivery.customerConfirmedAt,
    estimatedCost: Number(job.estimatedCost || 0),
    depositPaid: Number(job.depositPaid || 0),
    accessories: job.deviceIntake?.accessories || [],
    checks: { paymentConfirmed: true, deviceReturned: true, accessoriesReturned: true },
  };
  return mapHandover(await repository.finalize(job.id, actor.employeeId, input, snapshot));
}

module.exports = { confirmPublic, getStaff, finalize };
