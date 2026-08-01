const {
  executeGenerateMissingBarcodes,
} = require('./generateMissingBarcodesService');

const generateMissingBarcodes = async (req, res) => {
  try {
    const dryRun = req.body?.dryRun ?? req.query?.dryRun ?? 'false';
    const lotLabelPerLot = req.body?.lotLabelPerLot ?? req.query?.lotLabelPerLot ?? 1;

    const result = await executeGenerateMissingBarcodes({
      receiptId: req.params?.receiptId,
      branchId: req.user?.branchId,
      dryRun,
      lotLabelPerLot,
    });

    if (result.plan) {
      return res.status(200).json({
        success: true,
        dryRun: true,
        plan: result.plan,
        totalToCreate: result.totalToCreate,
      });
    }

    return res.status(200).json({
      success: true,
      createdCount: result.createdCount,
      barcodes: result.barcodes,
    });
  } catch (error) {
    console.error('[generateMissingBarcodes] ❌', error);
    if (error?.message === 'INVALID_RECEIPT_OR_BRANCH') {
      return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
    }
    if (error?.status === 404 || error?.message === 'NOT_FOUND_RECEIPT') {
      return res.status(404).json({ message: 'ไม่พบใบรับในสาขาของคุณ' });
    }
    if (error?.status === 400 || error?.message === 'COUNTER_OVERFLOW') {
      return res.status(400).json({ message: 'เกินโควต้า 9999 ต่อเดือนต่อสาขา' });
    }
    return res.status(500).json({ message: 'ไม่สามารถสร้างบาร์โค้ดได้' });
  }
};

module.exports = { generateMissingBarcodes };
