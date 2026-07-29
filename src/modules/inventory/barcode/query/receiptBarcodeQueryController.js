'use strict';

const receiptBarcodeQueryService = require('./receiptBarcodeQueryService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const toBoolean = (value) =>
  ['1', 'true', 'yes'].includes(String(value ?? '0').toLowerCase());

const getBarcodesByReceiptId = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const kindParam = String(req.query?.kind || '').toUpperCase();
    const kind = kindParam === 'SN' || kindParam === 'LOT' ? kindParam : undefined;

    const barcodes = await receiptBarcodeQueryService.getBarcodesByReceipt({
      receiptId,
      branchId,
      kind,
      onlyUnscanned: toBoolean(req.query?.onlyUnscanned),
      onlyUnactivated: toBoolean(req.query?.onlyUnactivated),
      includeFallback: toBoolean(req.query?.includeFallback),
    });

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(200).json({ success: true, count: barcodes.length, barcodes });
  } catch (error) {
    console.error('[getBarcodesByReceiptId] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงบาร์โค้ดได้' });
  }
};

module.exports = { getBarcodesByReceiptId };
