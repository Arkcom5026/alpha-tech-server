const service = require('./barcodeReceiptCompletionService');

const toInt = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const markReceiptAsCompleted = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId ?? req.params?.id);
  const branchId = toInt(req.user?.branchId);

  if (!receiptId || !branchId) {
    return res.status(400).json({ error: 'ต้องระบุ id และสิทธิ์สาขา' });
  }

  try {
    const receipt = await service.completeReceipt({ receiptId, branchId });
    return res.json({ success: true, receipt });
  } catch (error) {
    if (error?.message === 'RECEIPT_NOT_FOUND') {
      return res.status(404).json({ error: 'ไม่พบใบรับสินค้าสำหรับสาขานี้' });
    }
    if (error?.message === 'RECEIPT_COMPLETION_CONFLICT') {
      return res.status(409).json({ error: 'อัปเดตไม่สำเร็จ (อาจถูกเปลี่ยนแปลงแล้ว)' });
    }
    console.error('❌ [markReceiptAsCompleted] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะใบรับสินค้าได้' });
  }
};

module.exports = { markReceiptAsCompleted };
