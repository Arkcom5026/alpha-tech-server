const service = require('./platformCustomerOverviewService');

async function getOverview(req, res) {
  try {
    const result = await service.getOverview({
      userContext: req.user || {},
      query: req.query?.q,
      branchId: req.query?.branchId,
      provinceCode: req.query?.provinceCode,
      districtCode: req.query?.districtCode,
      relationshipStatus: req.query?.relationshipStatus,
      customerType: req.query?.customerType,
      accountStatus: req.query?.accountStatus,
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
