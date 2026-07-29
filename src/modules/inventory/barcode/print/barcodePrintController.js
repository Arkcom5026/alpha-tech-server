'use strict';

const printService = require('./barcodePrintService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const parseReceiptIds = (raw) =>
  String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0);

const getBarcodesForPrintBatch = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  const raw = String(req.query?.ids || '').trim();
  if (!Number.isInteger(branchId)) return res.status(400).json({ message: 'ต้องมีสิทธิ์สาขา' });
  if (!raw) return res.status(400).json({ message: 'กรุณาระบุ ids เช่น ?ids=458,451' });
  const receiptIds = parseReceiptIds(raw);
  if (!receiptIds.length) return res.status(400).json({ message: 'ids ไม่ถูกต้อง' });

  try {
    const barcodes = await printService.getPrintBatch({ branchId, receiptIds });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.status(200).json({ success: true, count: barcodes.length, barcodes });
  } catch (error) {
    console.error('[getBarcodesForPrintBatch] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถดึงบาร์โค้ดสำหรับพิมพ์แบบ batch ได้' });
  }
};

const getReceiptsWithBarcodes = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  if (!Number.isInteger(branchId)) return res.status(400).json({ message: 'ต้องมี branchId' });
  try {
    return res.json(await printService.getPendingPrintReceipts({ branchId }));
  } catch (error) {
    console.error('[getReceiptsWithBarcodes]', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบรับที่รอพิมพ์ได้' });
  }
};

const searchReprintReceipts = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  if (!Number.isInteger(branchId)) return res.status(400).json({ message: 'ต้องมี branchId' });
  const query = String(req.query?.query || '').trim();
  const supplierKeyword = String(req.query?.supplierKeyword || '').trim();
  if (!query && !supplierKeyword) return res.json([]);

  try {
    const rows = await printService.searchReprintReceipts({
      branchId,
      mode: String(req.query?.mode || 'RC').toUpperCase(),
      query,
      supplierKeyword,
      printed: String(req.query?.printed ?? 'true').toLowerCase() === 'true',
      limit: req.query?.limit,
    });
    return res.json(rows);
  } catch (error) {
    console.error('[searchReprintReceipts] ❌', error);
    return res.status(500).json({ message: 'ค้นหาใบรับสำหรับพิมพ์ซ้ำล้มเหลว' });
  }
};

const markBarcodesAsPrinted = async (req, res) => {
  const branchId = Number(req.user?.branchId);
  if (!branchId) return res.status(401).json({ message: 'unauthorized: missing branchId' });

  const receiptId = printService.extractReceiptId(req.body, req.query, req.get('x-receipt-id'));
  if (!Number.isFinite(receiptId) || receiptId <= 0) {
    return res.status(400).json({ message: 'ต้องระบุ purchaseOrderReceiptId (หรือ receiptId/id)' });
  }

  try {
    const result = await printService.markPrinted({ branchId, receiptId });
    return res.json({ success: true, updated: result.updated, receiptUpdated: result.receiptUpdated });
  } catch (error) {
    console.error('❌ [markBarcodesAsPrinted] error:', error);
    return res.status(500).json({ message: 'ไม่สามารถอัปเดตสถานะ printed ได้', error: error?.message });
  }
};

const reprintBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);
  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'พารามิเตอร์ไม่ถูกต้อง' });
  }

  try {
    const result = await printService.getReprintBarcodes({ receiptId, branchId });
    if (!result) return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return res.json({ success: true, count: result.length, barcodes: result });
  } catch (error) {
    console.error('[reprintBarcodes] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถพิมพ์ซ้ำได้' });
  }
};

module.exports = {
  getBarcodesForPrintBatch,
  getReceiptsWithBarcodes,
  searchReprintReceipts,
  markBarcodesAsPrinted,
  reprintBarcodes,
};
