const {
  findAuditSession,
  cancelAuditSession,
  confirmAuditSession,
} = require('./finalizeAuditRepository');

const validateSession = ({ session, branchId, action }) => {
  if (!session) return { status: 404, body: { message: 'α╣äα╕íα╣êα╕₧α╕Üα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╕¬α╕òα╣èα╕¡α╕ü' } };
  if (!Number.isFinite(branchId) || session.branchId !== branchId) {
    return { status: 403, body: { message: 'α╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕ùα╕ÿα╕┤α╣îα╣Çα╕éα╣ëα╕▓α╕ûα╕╢α╕çα╕úα╕¡α╕Üα╕Öα╕╡α╣ë' } };
  }
  if (session.mode !== 'READY') {
    return { status: 400, body: { message: 'α╣éα╕½α╕íα╕öα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕êα╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }
  if (session.confirmedAt || (session.status && session.status !== 'DRAFT')) {
    return action === 'confirm'
      ? { status: 409, body: { message: 'α╕úα╕¡α╕Üα╕Öα╕╡α╣ëα╕ûα╕╣α╕üα╕óα╕╖α╕Öα╕óα╕▒α╕Öα╣äα╕¢α╣üα╕Ñα╣ëα╕º' } }
      : { status: 409, body: { message: 'α╕úα╕¡α╕Üα╕Öα╕╡α╣ëα╕ûα╕╣α╕üα╕¢α╕┤α╕öα╣äα╕¢α╣üα╕Ñα╣ëα╕º' } };
  }
  return null;
};

const cancelAudit = async ({ sessionId, branchId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId, action: 'cancel' });
  if (invalid) return invalid;

  await (repositories.cancelAuditSession || cancelAuditSession)({ sessionId });
  return { status: 200, body: { ok: true, status: 'CANCELLED' } };
};

const confirmAudit = async ({ sessionId, branchId, strategy, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId, action: 'confirm' });
  if (invalid) return invalid;

  const targetStatus = strategy === 'MARK_LOST' ? 'LOST' : 'MISSING_PENDING_REVIEW';
  await (repositories.confirmAuditSession || confirmAuditSession)({ sessionId, targetStatus });
  return { status: 200, body: { confirmed: true } };
};

module.exports = { cancelAudit, confirmAudit };
