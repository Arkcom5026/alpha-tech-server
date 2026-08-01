const service = require('./uploadSlipRuntimeService');

const sendServiceResult = (res, result) => res.status(result.status).json(result.body);

const uploadAndSaveSlip = async (req, res) => {
  try {
    const result = await service.uploadAndSaveSlip({
      file: req.file,
      body: req.body || {},
      user: req.user || {},
    });

    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ uploadAndSaveSlip error:', error);

    if (service.isPrismaKnownRequestError(error)) {
      return res.status(400).json({
        message: 'เกิดข้อผิดพลาดฐานข้อมูล',
        code: error.code,
      });
    }

    return res.status(500).json({ message: 'Upload slip failed' });
  }
};

const deleteSlip = async (req, res) => {
  try {
    const result = await service.deleteSlip({
      publicId: req.body?.public_id,
    });

    return sendServiceResult(res, result);
  } catch (error) {
    console.error('❌ deleteSlip error:', error);
    return res.status(500).json({ message: 'ลบสลิปไม่สำเร็จ' });
  }
};

module.exports = {
  uploadAndSaveSlip,
  deleteSlip,
};
