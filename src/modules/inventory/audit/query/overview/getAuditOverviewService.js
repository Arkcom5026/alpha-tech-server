const { findAuditOverview } = require('./getAuditOverviewRepository');

const getAuditOverview = async ({ sessionId, branchId, repository = findAuditOverview }) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId ไม่ถูกต้อง' } };
  }
  if (!Number.isFinite(branchId)) {
    return { status: 403, body: { message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' } };
  }

  const session = await repository({ sessionId });
  if (!session) return { status: 404, body: { message: 'ไม่พบรอบเช็คสต๊อก' } };
  if (session.branchId !== branchId) {
    return { status: 403, body: { message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' } };
  }
  if (session.mode !== 'READY') {
    return { status: 400, body: { message: 'โหมดรอบตรวจไม่ถูกต้อง' } };
  }

  const missingCount = Math.max(0, (session.expectedCount || 0) - (session.scannedCount || 0));
  return { status: 200, body: { session, missingCount } };
};

module.exports = { getAuditOverview };
