const { toInt } = require('../../shared/customerControllerSupport');
const customerByNameService = require('./customerByNameService');

async function getCustomerByName(req, res) {
  try {
    const result = await customerByNameService.getCustomerByName({
      branchId: toInt(req.user?.branchId),
      rawQuery: req.query?.q,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('❌ getCustomerByName error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
}

module.exports = {
  getCustomerByName,
};
