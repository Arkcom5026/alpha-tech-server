const {
  findAuditSessionForItems,
  listAuditSnapshotItems,
} = require('./listAuditItemsRepository');

const normalizePositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(max, parsed);
};

const listAuditItems = async ({
  branchId,
  sessionId,
  scanned,
  q,
  page,
  pageSize,
  findSession = findAuditSessionForItems,
  listItems = listAuditSnapshotItems,
}) => {
  if (!Number.isFinite(sessionId)) {
    return { status: 400, body: { message: 'sessionId α╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }

  const session = await findSession({ sessionId });
  if (!session) return { status: 404, body: { message: 'α╣äα╕íα╣êα╕₧α╕Üα╕úα╕¡α╕Üα╣Çα╕èα╣çα╕äα╕¬α╕òα╣èα╕¡α╕ü' } };
  if (!Number.isFinite(branchId) || session.branchId !== branchId) {
    return { status: 403, body: { message: 'α╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕ùα╕ÿα╕┤α╣îα╣Çα╕éα╣ëα╕▓α╕ûα╕╢α╕çα╕úα╕¡α╕Üα╕Öα╕╡α╣ë' } };
  }
  if (session.mode !== 'READY') {
    return { status: 400, body: { message: 'α╣éα╕½α╕íα╕öα╕úα╕¡α╕Üα╕òα╕úα╕ºα╕êα╣äα╕íα╣êα╕ûα╕╣α╕üα╕òα╣ëα╕¡α╕ç' } };
  }

  const normalizedPage = normalizePositiveInt(page, 1);
  const normalizedPageSize = normalizePositiveInt(pageSize, 50, 200);
  const normalizedQuery = String(q || '').trim();
  const result = await listItems({
    sessionId,
    scanned,
    q: normalizedQuery,
    page: normalizedPage,
    pageSize: normalizedPageSize,
  });

  return {
    status: 200,
    body: {
      items: result.items.map((item) => ({
        id: item.id,
        barcode: item.barcode,
        serialNumber: item.stockItem?.serialNumber || null,
        isScanned: item.isScanned,
        scannedAt: item.scannedAt,
        product: item.product,
      })),
      total: result.total,
      page: normalizedPage,
      pageSize: normalizedPageSize,
    },
  };
};

module.exports = { listAuditItems, normalizePositiveInt };
