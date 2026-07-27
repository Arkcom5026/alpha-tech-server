const crypto = require('crypto');

const DECISIONS = new Set(['APPROVED', 'REJECTED']);

function createHttpError(statusCode, code, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  error.details = details;
  error.isOperational = true;
  return error;
}

function hashTrackingToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function requirePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, 'INVALID_ESTIMATE_APPROVAL_INPUT', `${field} ไม่ถูกต้อง`, { field });
  }
  return parsed;
}

function validatePublishInput(job, input = {}) {
  const expiryDays = Number(input.expiryDays || 14);
  if (!Number.isInteger(expiryDays) || expiryDays < 1 || expiryDays > 90) {
    throw createHttpError(
      400,
      'INVALID_ESTIMATE_APPROVAL_EXPIRY',
      'expiryDays ต้องอยู่ระหว่าง 1 ถึง 90 วัน'
    );
  }

  const estimateAmount = Number(job.estimatedCost || 0);
  const depositAmount = Number(job.depositPaid || 0);
  if (!Number.isFinite(estimateAmount) || estimateAmount <= 0) {
    throw createHttpError(
      400,
      'ESTIMATE_AMOUNT_REQUIRED',
      'กรุณาบันทึกราคาประเมินที่มากกว่า 0 ก่อนส่งให้ลูกค้า'
    );
  }

  return {
    estimateAmount,
    depositAmount,
    balanceAmount: Math.max(estimateAmount - depositAmount, 0),
    requestNote: String(input.requestNote || '').trim().slice(0, 2000) || null,
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000),
  };
}

function validateDecisionInput(input = {}) {
  const decision = String(input.decision || '').trim().toUpperCase();
  if (!DECISIONS.has(decision)) {
    throw createHttpError(
      400,
      'INVALID_ESTIMATE_DECISION',
      'decision ต้องเป็น APPROVED หรือ REJECTED'
    );
  }
  const confirmedByName = String(input.confirmedByName || '').trim();
  if (!confirmedByName || confirmedByName.length > 255) {
    throw createHttpError(
      400,
      'ESTIMATE_CONFIRMER_REQUIRED',
      'กรุณาระบุชื่อผู้ยืนยัน',
      { field: 'confirmedByName' }
    );
  }
  return {
    approvalId: requirePositiveInteger(input.approvalId, 'approvalId'),
    decision,
    confirmedByName,
    customerNote: String(input.customerNote || '').trim().slice(0, 2000) || null,
  };
}

function mapApproval(row) {
  if (!row) return null;
  const expired =
    row.status === 'PENDING' &&
    row.expiresAt &&
    new Date(row.expiresAt).getTime() <= Date.now();
  return {
    id: Number(row.id),
    status: expired ? 'EXPIRED' : row.status,
    estimateAmount: Number(row.estimateAmount || 0),
    depositAmount: Number(row.depositAmount || 0),
    balanceAmount: Number(row.balanceAmount || 0),
    requestNote: row.requestNote || null,
    customerNote: row.customerNote || null,
    confirmedByName: row.confirmedByName || null,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    decidedAt: row.decidedAt,
    currency: 'THB',
  };
}

module.exports = {
  createHttpError,
  hashTrackingToken,
  validatePublishInput,
  validateDecisionInput,
  mapApproval,
};
