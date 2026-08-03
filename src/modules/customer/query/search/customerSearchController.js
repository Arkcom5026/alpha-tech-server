const { toInt } = require('../../shared/customerControllerSupport');
const service = require('./customerSearchService');

async function searchCustomers(req, res) {
  try {
    const result = await service.searchCustomers({
      branchId: toInt(req.user?.branchId),
      rawQuery: req.query?.q,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('[customerSearchController] search failed:', error);
    return res.status(500).json({
      code: 'CUSTOMER_SEARCH_FAILED',
      message: 'ค้นหาลูกค้าไม่สำเร็จ',
    });
  }
}

module.exports = { searchCustomers };
