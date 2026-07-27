const {
  findAuditSession,
  findEmployeeId,
  scanBarcodeTransaction,
  scanSerialTransaction,
} = require('./scanAuditRepository');

const validateSession = ({ session, branchId }) => {
  if (!session) return { status: 404, body: { message: 'α╣äα╕íα╣êα╕₧α╕Üα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╕¬α╕òα╣èα╕¡α╕ü' } };
  if (!Number.isFinite(branchId) || session.branchId !== branchId) {
    return { status: 403, body: { message: 'α╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕ùα╕ÿα╕┤α╣îα╣Çα╕éα╣ëα╕▓α╕ûα╕╢α╕çα╕úα╕¡α╕Üα╕Öα╕╡α╣ë' } };
  }
  if (session.mode !== 'READY') return { status: 400, body: { message: 'α╣éα╕½α╕íα╕öα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕êα╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  if (session.confirmedAt || (session.status && session.status !== 'DRAFT')) {
    return { status: 409, body: { message: 'α╕úα╕¡α╕Üα╕Öα╕╡α╣ëα╕ûα╕╣α╕üα╕¢α╕┤α╕öα╕üα╕▓α╕úα╕¬α╣üα╕üα╕Öα╣üα╕Ñα╣ëα╕º' } };
  }
  return null;
};

const resolveEmployee = async ({ userId, employeeId, repository = findEmployeeId }) => {
  const resolved = await repository({ userId, employeeId });
  if (!resolved) return { error: { status: 403, body: { message: 'α╣äα╕íα╣êα╕₧α╕Üα╕éα╣ëα╕¡α╕íα╕╣α╕Ñα╕₧α╕Öα╕▒α╕üα╕çα╕▓α╕Öα╕éα╕¡α╕çα╕£α╕╣α╣ëα╣âα╕èα╣ëα╕çα╕▓α╕Ö (employeeProfile)' } } };
  return { employeeId: resolved };
};

const scanBarcode = async ({ sessionId, branchId, barcode, userId, employeeId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId });
  if (invalid) return invalid;

  const normalized = barcode ? String(barcode).trim() : '';
  if (!normalized) return { status: 400, body: { message: 'α╕üα╕úα╕╕α╕ôα╕▓α╕úα╕░α╕Üα╕╕α╕Üα╕▓α╕úα╣îα╣éα╕äα╣ëα╕ö' } };

  const actor = await resolveEmployee({ userId, employeeId, repository: repositories.findEmployeeId || findEmployeeId });
  if (actor.error) return actor.error;

  const result = await (repositories.scanBarcodeTransaction || scanBarcodeTransaction)({
    sessionId,
    barcode: normalized,
    employeeId: actor.employeeId,
  });
  const messages = {
    NOT_IN_EXPECTED_SET: 'α╕Üα╕▓α╕úα╣îα╣éα╕äα╣ëα╕öα╕Öα╕╡α╣ëα╣äα╕íα╣êα╕¡α╕óα╕╣α╣êα╣âα╕Öα╕èα╕╕α╕öα╕äα╕▓α╕öα╕½α╕ºα╕▒α╕çα╕éα╕¡α╕çα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕ê',
    DUPLICATE_SCAN: 'α╕Üα╕▓α╕úα╣îα╣éα╕äα╣ëα╕öα╕Öα╕╡α╣ëα╕ûα╕╣α╕üα╕¬α╣üα╕üα╕Öα╣äα╕¢α╣üα╕Ñα╣ëα╕ºα╣âα╕Öα╕úα╕¡α╕Üα╕Öα╕╡α╣ë',
    STOCK_ITEM_NOT_FOUND: 'α╣äα╕íα╣êα╕₧α╕Üα╕éα╣ëα╕¡α╕íα╕╣α╕Ñα╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣âα╕Öα╕¬α╕òα╣èα╕¡α╕ü',
  };
  return result.status === 200
    ? { status: 200, body: { scanned: true } }
    : { status: result.status, body: { message: messages[result.reason] || 'α╣Çα╕üα╕┤α╕öα╕éα╣ëα╕¡α╕£α╕┤α╕öα╕₧α╕Ñα╕▓α╕öα╣âα╕Öα╕üα╕▓α╕úα╕¬α╣üα╕üα╕Ö' } };
};

const scanSerial = async ({ sessionId, branchId, serialNumber, userId, employeeId, repositories = {} }) => {
  if (!Number.isFinite(sessionId)) return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };

  const session = await (repositories.findAuditSession || findAuditSession)({ sessionId });
  const invalid = validateSession({ session, branchId });
  if (invalid) return invalid;

  const normalized = serialNumber ? String(serialNumber).trim() : '';
  if (!normalized) return { status: 400, body: { message: 'α╕üα╕úα╕╕α╕ôα╕▓α╕úα╕░α╕Üα╕╕ Serial Number (SN)' } };

  const actor = await resolveEmployee({ userId, employeeId, repository: repositories.findEmployeeId || findEmployeeId });
  if (actor.error) return actor.error;

  const result = await (repositories.scanSerialTransaction || scanSerialTransaction)({
    sessionId,
    branchId,
    serialNumber: normalized,
    employeeId: actor.employeeId,
  });
  const messages = {
    SN_NOT_FOUND: 'α╣äα╕íα╣êα╕₧α╕Ü Serial Number α╕Öα╕╡α╣ëα╣âα╕Öα╕¬α╕òα╣èα╕¡α╕üα╕éα╕¡α╕çα╕¬α╕▓α╕éα╕▓',
    NOT_IN_EXPECTED_SET: 'α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╕Öα╕╡α╣ëα╣äα╕íα╣êα╕¡α╕óα╕╣α╣êα╣âα╕Öα╕èα╕╕α╕öα╕äα╕▓α╕öα╕½α╕ºα╕▒α╕çα╕éα╕¡α╕çα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕ê',
    DUPLICATE_SCAN: 'α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╕Öα╕╡α╣ëα╕ûα╕╣α╕üα╕¬α╣üα╕üα╕Öα╣äα╕¢α╣üα╕Ñα╣ëα╕ºα╣âα╕Öα╕úα╕¡α╕Üα╕Öα╕╡α╣ë',
  };
  return result.status === 200
    ? { status: 200, body: { scanned: true } }
    : { status: result.status, body: { message: messages[result.reason] || 'α╣Çα╕üα╕┤α╕öα╕éα╣ëα╕¡α╕£α╕┤α╕öα╕₧α╕Ñα╕▓α╕öα╣âα╕Öα╕üα╕▓α╕úα╕¬α╣üα╕üα╕Ö SN' } };
};

module.exports = { scanBarcode, scanSerial };
