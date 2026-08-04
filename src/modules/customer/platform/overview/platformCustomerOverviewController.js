const service = require('./platformCustomerOverviewService');

async function getOverview(req, res) {
  try {
    const result = await service.getOverview({
      userContext: req.user || {},
      query: req.query?.q,
      limit: req.query?.limit,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[platformCustomerOverviewController] overview failed:', error);
    return res.status(500).json({
      code: 'PLATFORM_CUSTOMER_OVERVIEW_FAILED',
      message: 'โหลดภาพรวมลูกค้าแพลตฟอร์มไม่สำเร็จ',
    });
  }
}

module.exports = { getOverview };
