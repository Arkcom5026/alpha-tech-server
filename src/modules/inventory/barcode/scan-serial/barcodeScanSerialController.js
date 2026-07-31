const service = require('./barcodeScanSerialService');

const getReceiptsReadyToScanSN = async (req, res) => {
  try {
    const branchId = service.toInt(req.user?.branchId);
    if (!Number.isInteger(branchId)) {
      return res.status(400).json({ message: 'ต้องมี branchId' });
    }

    const rows = await service.listReadyToScanSn({ branchId });
    return res.json(rows);
  } catch (error) {
    console.error('[getReceiptsReadyToScanSN] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการที่พร้อมยิง SN ได้' });
  }
};

const getReceiptsReadyToScan = async (req, res) => {
  try {
    const branchId = service.toInt(req.user?.branchId);
    if (!Number.isInteger(branchId)) {
      return res.status(400).json({ message: 'ต้องมี branchId' });
    }

    const rows = await service.listReadyToScan({ branchId });
    return res.json(rows);
  } catch (error) {
    console.error('[getReceiptsReadyToScan] ❌', error);
    return res.status(500).json({ message: 'ไม่สามารถโหลดรายการใบที่พร้อมยิง/เปิดล็อตได้' });
  }
};

const updateSerialNumber = async (req, res) => {
  try {
    const branchId = service.toInt(req.user?.branchId);
    const { barcode, serialNumber } = req.body || {};

    if (!branchId) return res.status(401).json({ message: 'unauthorized' });
    if (!barcode || !serialNumber) {
      return res.status(400).json({ message: 'barcode และ serialNumber จำเป็น' });
    }

    const stockItem = await service.changeSerialNumber({ branchId, barcode, serialNumber });
    return res.json({ success: true, stockItem });
  } catch (error) {
    if (error?.message === 'BARCODE_NOT_FOUND') {
      return res.status(404).json({ message: 'ไม่พบบาร์โค้ด' });
    }
    if (error?.message === 'STOCK_ITEM_NOT_LINKED') {
      return res.status(400).json({ message: 'รายการนี้ยังไม่มี stock item' });
    }
    if (error?.message === 'STOCK_ITEM_SOLD') {
      return res.status(400).json({ message: 'สินค้าถูกขายแล้ว ไม่สามารถแก้ SN ได้' });
    }
    if (error?.message === 'SERIAL_DUPLICATE') {
      return res.status(400).json({ message: 'SN นี้มีอยู่แล้วในระบบ' });
    }

    console.error('[updateSerialNumber] ❌', error);
    return res.status(500).json({ message: 'แก้ SN ไม่สำเร็จ' });
  }
};

module.exports = {
  getReceiptsReadyToScanSN,
  getReceiptsReadyToScan,
  updateSerialNumber,
};
