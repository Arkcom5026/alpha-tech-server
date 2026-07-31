const ACTIVE_TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const SLA_HOURS_BY_STATUS = Object.freeze({
  RECEIVED: 4,
  IN_PROGRESS: 24,
  WAITING_PARTS: 72,
});

function toDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(fromValue, toValue = new Date()) {
  const from = toDate(fromValue);
  const to = toDate(toValue);
  if (!from || !to) return 0;
  return Math.max(0, (to.getTime() - from.getTime()) / 36e5);
}

function projectRepairOperationalState(job, now = new Date()) {
  const status = String(job?.status || '').toUpperCase();
  const ageHours = hoursBetween(job?.updatedAt || job?.createdAt, now);
  const slaHours = SLA_HOURS_BY_STATUS[status] || null;
  const overdue = Boolean(slaHours && ageHours > slaHours);
  const terminal = ACTIVE_TERMINAL_STATUSES.has(status);
  const intakeIncomplete = Boolean(job?.deviceIntakes?.[0]) && (
    !job.deviceIntakes[0].consent ||
    !(job.deviceIntakes[0].photos || []).some((photo) =>
      String(photo.category || '').toUpperCase() === 'INTAKE_CONDITION'
    )
  );

  const exceptions = [];
  if (!terminal && !job?.technicianId) exceptions.push('UNASSIGNED_TECHNICIAN');
  if (status === 'RECEIVED' && intakeIncomplete) exceptions.push('INTAKE_INCOMPLETE');
  if (status === 'WAITING_PARTS') exceptions.push('WAITING_PARTS');
  if (status === 'IN_PROGRESS' && Number(job?.estimatedCost || 0) > 0) {
    exceptions.push('WAITING_CUSTOMER_APPROVAL');
  }
  if (status === 'COMPLETED' && !job?.repairDeliveries?.length) {
    exceptions.push('WAITING_CUSTOMER_PICKUP');
  }
  if (overdue) exceptions.push('SLA_OVERDUE');

  return {
    status,
    terminal,
    ageHours: Number(ageHours.toFixed(2)),
    slaHours,
    overdue,
    exceptions,
    priority: overdue ? 'HIGH' : exceptions.length ? 'MEDIUM' : 'NORMAL',
  };
}

function summarizeRepairOperations(items = []) {
  const summary = {
    total: items.length,
    active: 0,
    overdue: 0,
    unassigned: 0,
    intakeIncomplete: 0,
    waitingParts: 0,
    waitingCustomerApproval: 0,
    waitingCustomerPickup: 0,
  };

  items.forEach((item) => {
    const operational = item.operational || {};
    if (!operational.terminal) summary.active += 1;
    if (operational.overdue) summary.overdue += 1;
    if (operational.exceptions?.includes('UNASSIGNED_TECHNICIAN')) summary.unassigned += 1;
    if (operational.exceptions?.includes('INTAKE_INCOMPLETE')) summary.intakeIncomplete += 1;
    if (operational.exceptions?.includes('WAITING_PARTS')) summary.waitingParts += 1;
    if (operational.exceptions?.includes('WAITING_CUSTOMER_APPROVAL')) summary.waitingCustomerApproval += 1;
    if (operational.exceptions?.includes('WAITING_CUSTOMER_PICKUP')) summary.waitingCustomerPickup += 1;
  });

  return summary;
}

module.exports = {
  SLA_HOURS_BY_STATUS,
  hoursBetween,
  projectRepairOperationalState,
  summarizeRepairOperations,
};
