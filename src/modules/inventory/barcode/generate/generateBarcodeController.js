'use strict';

const generateBarcodeService = require('./generateBarcodeService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const generateMissingBarcodes = async (req, res) => {
  const receiptId = toInt(req.params?.receiptId);
  const branchId = toInt(req.user?.branchId);

  if (!Number.isInteger(receiptId) || !Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'กรุณาระบุ receiptId และต้องมีสิทธิ์สาขา' });
  }

  try {
    const rawDryRun = req.body?.dryRun ?? req.query?.dryRun ?? 'false';
    const dryRun = ['1', 'true'].includes(String(rawDryRun).toLowerCase());
    const lotLabelPerLot = Math.max(
      1,
      Number(req.body?.lotLabelPerLot ?? req.query?.lotLabelPerLot ?? 1)
    );

    const result = await generateBarcodeService.generateMissingBarcodes({
      receiptId,
      branchId,
      dryRun,
      lotLabelPerLot,
    });

    if (dryRun) {
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
