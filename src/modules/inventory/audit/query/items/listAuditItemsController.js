const { listAuditItems: listAuditItemsService } = require('./listAuditItemsService');

const setNoStoreHeaders = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
};

const listAuditItems = async (req, res) => {
  try {
    setNoStoreHeaders(res);
    const result = await listAuditItemsService({
      branchId: Number(req.user?.branchId),
      sessionId: Number.parseInt(req.params.sessionId, 10),
      scanned: req.query.scanned,
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [listAuditItems] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงรายการได้' });
  }
};

module.exports = { listAuditItems, setNoStoreHeaders };
