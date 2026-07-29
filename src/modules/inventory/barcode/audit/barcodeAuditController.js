'use strict';

const auditService = require('./barcodeAuditService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const auditReceiptBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);
  const includeDetails = ['1', 'true'].includes(
    String(req.query?.includeDetails || '0').toLowerCase()
  );

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const result = await auditService.auditReceiptBarcodes({
      receiptId,
      branchId,
      includeDetails,
    });

    if (!result) {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }

    return res.json(result);
  } catch (error) {
    console.error('[auditReceiptBarcodes] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถตรวจสอบสถานะบาร์โค้ดได้' });
  }
};

module.exports = { auditReceiptBarcodes };
