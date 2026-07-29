'use strict';

const completionService = require('./receiptCompletionService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const markReceiptAsCompleted = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId ?? req.params?.id);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ error: 'ต้องระบุ id และสิทธิ์สาขา' });
  }

  try {
    const result = await completionService.completeReceipt({ receiptId, branchId });

    if (result.code === 'RECEIPT_NOT_FOUND') {
      return res.status(404).json({ error: 'ไม่พบใบรับสินค้าสำหรับสาขานี้' });
    }
    if (result.code === 'UPDATE_CONFLICT') {
      return res.status(409).json({ error: 'อัปเดตไม่สำเร็จ (อาจถูกเปลี่ยนแปลงแล้ว)' });
    }

    return res.json({ success: true, receipt: result.receipt });
  } catch (error) {
    console.error('❌ [markReceiptAsCompleted] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะใบรับสินค้าได้' });
  }
};

module.exports = { markReceiptAsCompleted };
