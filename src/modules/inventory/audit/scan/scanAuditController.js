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
    console.error('Γ¥î [scanBarcode] error:', error);
    return res.status(500).json({ message: 'α╕¬α╣üα╕üα╕Öα╕Üα╕▓α╕úα╣îα╣éα╕äα╣ëα╕öα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
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
    console.error('Γ¥î [scanSn] error:', error);
    return res.status(500).json({ message: 'α╕¬α╣üα╕üα╕Ö SN α╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
  }
};

module.exports = { scanBarcodeController, scanSerialController };
