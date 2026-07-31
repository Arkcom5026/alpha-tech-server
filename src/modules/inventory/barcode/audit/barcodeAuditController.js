const service = require('./barcodeAuditService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

async function auditReceiptBarcodes(req, res) {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);
  const includeDetails =
    String(req.query?.includeDetails || '0').toLowerCase() === '1' ||
    String(req.query?.includeDetails || '').toLowerCase() === 'true';

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const result = await service.auditReceiptBarcodes({ receiptId, branchId, includeDetails });
    return res.json(result);
  } catch (error) {
    if (error?.status === 404 || error?.message === 'RECEIPT_NOT_FOUND') {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }
    console.error('[auditReceiptBarcodes] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถตรวจสอบสถานะบาร์โค้ดได้' });
  }
}

module.exports = { auditReceiptBarcodes };
