const { scanBarcode, scanSerial } = require('./scanAuditService');

const scanBarcodeController = async (req, res) => {
  try {
    const result = await scanBarcode({
      sessionId: parseInt(req.params.sessionId, 10),
      branchId: Number(req.user?.branchId),
      barcode: req.body?.barcode,
      userId: req.user?.id,
      employeeId: req.user?.employeeId,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [scanBarcode] error:', error);
    return res.status(500).json({ message: 'สแกนบาร์โค้ดไม่สำเร็จ' });
  }
};

const scanSerialController = async (req, res) => {
  try {
    const result = await scanSerial({
      sessionId: parseInt(req.params.sessionId, 10),
      branchId: Number(req.user?.branchId),
      serialNumber: req.body?.sn ?? req.body?.serialNumber,
      userId: req.user?.id,
      employeeId: req.user?.employeeId,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('❌ [scanSn] error:', error);
    return res.status(500).json({ message: 'สแกน SN ไม่สำเร็จ' });
  }
};

module.exports = { scanBarcodeController, scanSerialController };
