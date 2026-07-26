const service = require('./listReceiptBarcodeSummariesService');

const handle = async (req, res) => {
  try {
    const summaries = await service.execute({
      branchId: Number(req.user?.branchId),
      printedRaw: req.query?.printed,
    });

    res.set('Cache-Control', 'no-store');
    return res.json(summaries);
  } catch (error) {
    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    console.error('❌ [getReceiptBarcodeSummaries] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลใบรับสินค้าสำหรับพิมพ์บาร์โค้ดได้' });
  }
};

module.exports = { handle };
