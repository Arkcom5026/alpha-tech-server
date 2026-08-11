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

function validateCustomerConfirmation(workflowStatus, payload = {}) {
  requireReadyForDelivery(
    workflowStatus,
    'REPAIR_NOT_READY_FOR_PICKUP',
    'งานยังไม่พร้อมส่งมอบ กรุณารอให้ร้านดำเนินการงานหลักให้เสร็จก่อน'
  );
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

function validateFinalization(workflowStatus, delivery, payload = {}) {
  requireReadyForDelivery(
    workflowStatus,
    'REPAIR_NOT_READY_FOR_HANDOVER',
    'งานยังไม่พร้อมส่งมอบ กรุณาดำเนินการงานหลักให้เสร็จก่อน'
  );
  if (!delivery?.customerConfirmedAt) {
    throw createError(409, 'CUSTOMER_PICKUP_NOT_CONFIRMED', 'ลูกค้ายังไม่ได้ยืนยันรับเครื่อง');
  }
  if (!payload.paymentConfirmed || !payload.deviceReturned || !payload.accessoriesReturned) {
    throw createError(
      400,
      'HANDOVER_CHECKLIST_INCOMPLETE',
      'กรุณาตรวจสอบการชำระเงิน เครื่อง และอุปกรณ์ที่ฝากไว้ให้ครบ'
    );
  }
  return {
    paymentConfirmed: true,
    deviceReturned: true,
    accessoriesReturned: true,
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
