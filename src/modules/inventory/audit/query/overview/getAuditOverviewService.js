const { findAuditOverview } = require('./getAuditOverviewRepository');

const getAuditOverview = async ({ sessionId, branchId, repository = findAuditOverview }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }
  if (!Number.isFinite(branchId)) {
    return { status: 403, body: { message: 'α╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕ùα╕ÿα╕┤α╣îα╣Çα╕éα╣ëα╕▓α╕ûα╕╢α╕çα╕úα╕¡α╕Üα╕Öα╕╡α╣ë' } };
  }

  const session = await repository({ sessionId });
  if (!session) return { status: 404, body: { message: 'α╣äα╕íα╣êα╕₧α╕Üα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╕¬α╕òα╣èα╕¡α╕ü' } };
  if (session.branchId !== branchId) {
    return { status: 403, body: { message: 'α╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕ùα╕ÿα╕┤α╣îα╣Çα╕éα╣ëα╕▓α╕ûα╕╢α╕çα╕úα╕¡α╕Üα╕Öα╕╡α╣ë' } };
  }
  if (session.mode !== 'READY') {
    return { status: 400, body: { message: 'α╣éα╕½α╕íα╕öα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕êα╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }

  const missingCount = Math.max(0, (session.expectedCount || 0) - (session.scannedCount || 0));
  return { status: 200, body: { session, missingCount } };
};

module.exports = { getAuditOverview };
