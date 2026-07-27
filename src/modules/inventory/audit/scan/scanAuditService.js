const {
  findAuditSession,
  findEmployeeId,
  scanBarcodeTransaction,
  scanSerialTransaction,
} = require('./scanAuditRepository');

const validateSession = ({ session, branchId }) => {
  if (!session) return { status: 404, body: { message: 'ไม่พบรอบเช็คสต๊อก' } };
  if (!Number.isFinite(branchId) || session.branchId !== branchId) {
    return { status: 403, body: { message: 'ไม่มีสิทธิ์เข้าถึงรอบนี้' } };
  }
  if (session.mode !== 'READY') return { status: 400, body: { message: 'โหมดรอบตรวจไม่ถูกต้อง' } };
  if (session.confirmedAt || (session.status && session.status !== 'DRAFT')) {
    return { status: 409, body: { message: 'รอบนี้ถูกปิดการสแกนแล้ว' } };
  }
  return null;
};

const resolveEmployee = async ({ userId, employeeId, repository = findEmployeeId }) => {
  const resolved = await repository({ userId, employeeId });
  if (!resolved) return { error: { status: 403, body: { message: 'ไม่พบข้อมูลพนักงานของผู้ใช้งาน (employeeProfile)' } } };
  return { employeeId: resolved };
};

const scanBarcode = async ({ sessionId, branchId, barcode, userId, employeeId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) return { status: 400, body: { message: 'sessionId ไม่ถูกต้อง' } };

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId });
  if (invalid) return invalid;

  const normalized = barcode ? String(barcode).trim() : '';
  if (!normalized) return { status: 400, body: { message: 'กรุณาระบุบาร์โค้ด' } };

  const actor = await resolveEmployee({ userId, employeeId, repository: repositories.findEmployeeId || findEmployeeId });
  if (actor.error) return actor.error;

  const result = await (repositories.scanBarcodeTransaction || scanBarcodeTransaction)({
    sessionId,
    barcode: normalized,
    employeeId: actor.employeeId,
  });
  const messages = {
    NOT_IN_EXPECTED_SET: 'บาร์โค้ดนี้ไม่อยู่ในชุดคาดหวังของรอบตรวจ',
    DUPLICATE_SCAN: 'บาร์โค้ดนี้ถูกสแกนไปแล้วในรอบนี้',
    STOCK_ITEM_NOT_FOUND: 'ไม่พบข้อมูลสินค้าในสต๊อก',
  };
  return result.status === 200
    ? { status: 200, body: { scanned: true } }
    : { status: result.status, body: { message: messages[result.reason] || 'เกิดข้อผิดพลาดในการสแกน' } };
};

const scanSerial = async ({ sessionId, branchId, serialNumber, userId, employeeId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) return { status: 400, body: { message: 'sessionId ไม่ถูกต้อง' } };

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId });
  if (invalid) return invalid;

  const normalized = serialNumber ? String(serialNumber).trim() : '';
  if (!normalized) return { status: 400, body: { message: 'กรุณาระบุ Serial Number (SN)' } };

  const actor = await resolveEmployee({ userId, employeeId, repository: repositories.findEmployeeId || findEmployeeId });
  if (actor.error) return actor.error;

  const result = await (repositories.scanSerialTransaction || scanSerialTransaction)({
    sessionId,
    branchId,
    serialNumber: normalized,
    employeeId: actor.employeeId,
  });
  const messages = {
    SN_NOT_FOUND: 'ไม่พบ Serial Number นี้ในสต๊อกของสาขา',
    NOT_IN_EXPECTED_SET: 'สินค้านี้ไม่อยู่ในชุดคาดหวังของรอบตรวจ',
    DUPLICATE_SCAN: 'สินค้านี้ถูกสแกนไปแล้วในรอบนี้',
  };
  return result.status === 200
    ? { status: 200, body: { scanned: true } }
    : { status: result.status, body: { message: messages[result.reason] || 'เกิดข้อผิดพลาดในการสแกน SN' } };
};

module.exports = { scanBarcode, scanSerial };
