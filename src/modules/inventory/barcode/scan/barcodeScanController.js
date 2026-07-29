'use strict';

const scanService = require('./barcodeScanService');

const toInt = (value) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const getReceiptsReadyToScanSN = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  if (!Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องมี branchId' });
  }

  try {
    return res.json(await scanService.getReceiptsReadyToScanSN({ branchId }));
  } catch (error) {
    console.error('[getReceiptsReadyToScanSN] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการที่พร้อมยิง SN ได้' });
  }
};

const getReceiptsReadyToScan = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  if (!Number.isInteger(branchId)) {
    return res.status(400).json({ message: 'ต้องมี branchId' });
  }

  try {
    return res.json(await scanService.getReceiptsReadyToScan({ branchId }));
  } catch (error) {
    console.error('[getReceiptsReadyToScan] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบที่พร้อมยิง/เปิดล็อตได้' });
  }
};

const updateSerialNumber = async (req, res) => {
  const branchId = toInt(req.user?.branchId);
  const { barcode, serialNumber } = req.body || {};

  if (!branchId) return res.status(401).json({ message: 'unauthorized' });
  if (!barcode || !serialNumber) {
    return res.status(400).json({ message: 'barcode และ serialNumber จำเป็น' });
  }

  try {
    const result = await scanService.updateSerialNumber({ branchId, barcode, serialNumber });
    if (result.code === 'BARCODE_NOT_FOUND') {
      return res.status(404).json({ message: 'ไม่พบบาร์โค้ด' });
    }
    if (result.code === 'STOCK_ITEM_MISSING') {
      return res.status(400).json({ message: 'รายการนี้ยังไม่มี stock item' });
    }
    if (result.code === 'STOCK_ITEM_SOLD') {
      return res.status(400).json({ message: 'สินค้าถูกขายแล้ว ไม่สามารถแก้ SN ได้' });
    }
    if (result.code === 'SERIAL_DUPLICATE') {
      return res.status(400).json({ message: 'SN นี้มีอยู่แล้วในระบบ' });
    }
    return res.json({ success: true, stockItem: result.stockItem });
  } catch (error) {
    console.error('[updateSerialNumber] ❌', error);
    return res.status(500).json({ message: 'แก้ SN ไม่สำเร็จ' });
  }
};

module.exports = {
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
};