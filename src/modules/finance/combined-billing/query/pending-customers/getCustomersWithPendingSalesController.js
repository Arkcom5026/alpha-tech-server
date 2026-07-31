const {
  GetCustomersWithPendingSalesService,
} = require('./getCustomersWithPendingSalesService');

const service = new GetCustomersWithPendingSalesService();

const getCustomersWithPendingSales = async (req, res) => {
  try {
    const result = await service.execute({
      branchId: req.user?.branchId,
      keyword: req.query?.keyword,
    });

    return res.json(result);
  } catch (error) {
    if (error?.statusCode === 401) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    console.error('❌ [getCustomersWithPendingSales] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลลูกค้าได้' });
  }
};

module.exports = { getCustomersWithPendingSales };
