const {
  findAuditSession,
  cancelAuditSession,
  confirmAuditSession,
} = require('./finalizeAuditRepository');

const validateSession = ({ session, branchId, action }) => {
  if (!session) return { status: 404, body: { message: 'ไม่พบรอบเช็คสต๊อก' } };
  if (!Number.isFinite(branchId) || session.branchId !== branchId) {
    return { status: 403, body: { message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' } };
  }
  if (session.mode !== 'READY') {
    return { status: 400, body: { message: 'โหมดรอบตรวจไม่ถูกต้อง' } };
  }
  if (session.confirmedAt || (session.status && session.status !== 'DRAFT')) {
    return action === 'confirm'
      ? { status: 409, body: { message: 'รอบนี้ถูกยืนยันไปแล้ว' } }
      : { status: 409, body: { message: 'รอบนี้ถูกปิดไปแล้ว' } };
  }
  return null;
};

const cancelAudit = async ({ sessionId, branchId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId ไม่ถูกต้อง' } };
  }

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId, action: 'cancel' });
  if (invalid) return invalid;

  await (repositories.cancelAuditSession || cancelAuditSession)({ sessionId });
  return { status: 200, body: { ok: true, status: 'CANCELLED' } };
};

const confirmAudit = async ({ sessionId, branchId, strategy, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId ไม่ถูกต้อง' } };
  }

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId, action: 'confirm' });
  if (invalid) return invalid;

  const targetStatus = strategy === 'MARK_LOST' ? 'LOST' : 'MISSING_PENDING_REVIEW';
  await (repositories.confirmAuditSession || confirmAuditSession)({ sessionId, targetStatus });
  return { status: 200, body: { confirmed: true } };
};

module.exports = { cancelAudit, confirmAudit };
