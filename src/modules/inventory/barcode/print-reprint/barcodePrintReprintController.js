const service = require('./barcodePrintReprintService');

const setNoCache = (res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

const pickId = (source) => {
  if (source == null) return undefined;
  if (typeof source === 'number' || (typeof source === 'string' && source.trim() !== '')) {
    const value = Number(source);
    if (Number.isFinite(value) && value > 0) return value;
  }
  if (typeof source !== 'object') return undefined;

  const candidates = [
    source.purchaseOrderReceiptId,
    source.receiptId,
    source.id,
    source.purchaseOrderReceipt?.id,
    source.payload?.id,
    source.data?.id,
    source.purchaseOrderReceiptId?.id,
    source.purchaseOrderReceiptId?.purchaseOrderReceiptId,
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
};

const getBarcodesForPrintBatch = async (req, res) => {
  try {
    const result = await service.getPrintBatch({
      branchId: service.toInt(req.user?.branchId),
      rawIds: req.query?.ids,
    });
    if (result.status === 200) setNoCache(res);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[getBarcodesForPrintBatch] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงบาร์โค้ดสำหรับพิมพ์แบบ batch ได้' });
  }
};

const markBarcodesAsPrinted = async (req, res) => {
  try {
    const purchaseOrderReceiptId =
      pickId(req.body) ?? pickId(req.query) ?? Number(req.get('x-receipt-id'));
    const result = await service.markPrinted({
      branchId: Number(req.user?.branchId),
      purchaseOrderReceiptId,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [markBarcodesAsPrinted] error:', error);
    return res.status(500).json({
      message: 'ไม่สามารถอัปเดตสถานะ printed ได้',
      error: error?.message,
    });
  }
};

const getReceiptsWithBarcodes = async (req, res) => {
  try {
    const result = await service.getWaitingReceipts(service.toInt(req.user?.branchId));
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[getReceiptsWithBarcodes]', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบรับที่รอพิมพ์ได้' });
  }
};

const searchReprintReceipts = async (req, res) => {
  try {
    const result = await service.searchReprint({
      branchId: service.toInt(req.user?.branchId),
      mode: req.query?.mode,
      query: req.query?.query,
      supplierKeyword: req.query?.supplierKeyword,
      printed: req.query?.printed,
      limit: req.query?.limit,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[searchReprintReceipts] ❌', error);
    return res.status(500).json({ message: 'ค้นหาใบรับสำหรับพิมพ์ซ้ำล้มเหลว' });
  }
};

const reprintBarcodes = async (req, res) => {
  try {
    const result = await service.getReprintBarcodes({
      receiptId: service.toInt(req.params?.receiptId),
      branchId: service.toInt(req.user?.branchId),
    });
    if (result.status === 200) setNoCache(res);
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[reprintBarcodes] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถพิมพ์ซ้ำได้' });
  }
};

module.exports = {
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  reprintBarcodes,
  markBarcodesAsPrinted,
};
