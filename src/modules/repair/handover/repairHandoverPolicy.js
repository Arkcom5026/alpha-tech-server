function createError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

function requireReadyForDelivery(workflowStatus, code, message) {
  if (workflowStatus !== 'READY_FOR_DELIVERY') {
    throw createError(409, code, message);
  }
}

function normalizeReceiver(payload = {}) {
  const receiverName = String(payload.receiverName || '').trim();
  if (receiverName.length < 2 || receiverName.length > 160) {
    throw createError(400, 'INVALID_PICKUP_RECEIVER', 'กรุณาระบุชื่อผู้รับเครื่อง');
  }
  return {
    receiverName,
    receiverPhone: String(payload.receiverPhone || '').trim().slice(0, 40) || null,
    note: String(payload.note || '').trim().slice(0, 1000) || null,
  };
}

function validateCustomerConfirmation(workflowStatus, payload = {}) {
  requireReadyForDelivery(
    workflowStatus,
    'REPAIR_NOT_READY_FOR_PICKUP',
    'งานยังไม่พร้อมส่งมอบ'
  );
  return normalizeReceiver(payload);
}

function validateFinalization(workflowStatus, delivery, payload = {}) {
  requireReadyForDelivery(
    workflowStatus,
    'REPAIR_NOT_READY_FOR_HANDOVER',
    'งานยังไม่พร้อมส่งมอบ'
  );

  let staffReceiver = null;
  if (!delivery?.customerConfirmedAt) {
    staffReceiver = normalizeReceiver(payload);
  }

  const consolidatedConfirmation = payload.handoverConfirmed === true;
  const legacyChecksComplete = Boolean(
    payload.paymentConfirmed && payload.deviceReturned && payload.accessoriesReturned
  );
  if (!consolidatedConfirmation && !legacyChecksComplete) {
    throw createError(
      400,
      'HANDOVER_CONFIRMATION_REQUIRED',
      'กรุณายืนยันการชำระเงินและการส่งคืนเครื่องกับอุปกรณ์ให้ครบ'
    );
  }

  return {
    paymentConfirmed: true,
    deviceReturned: true,
    accessoriesReturned: true,
    receiverName: staffReceiver?.receiverName || null,
    receiverPhone: staffReceiver?.receiverPhone || null,
    note: String(payload.note || '').trim().slice(0, 1000) || null,
  };
}

function mapHandover(row) {
  if (!row) return { status: 'PENDING', customerConfirmedAt: null, deliveredAt: null };
  return {
    status: row.status,
    method: row.method,
    customerConfirmedBy: row.customerConfirmedBy || null,
    customerConfirmedAt: row.customerConfirmedAt || null,
    customerNote: row.customerNote || null,
    deliveredAt: row.deliveredAt || null,
    paymentConfirmed: Boolean(row.paymentConfirmed),
    deviceReturned: Boolean(row.deviceReturned),
    accessoriesReturned: Boolean(row.accessoriesReturned),
  };
}

module.exports = { validateCustomerConfirmation, validateFinalization, mapHandover };
