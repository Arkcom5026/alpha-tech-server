const { toInt } = require('../../../shared/customerControllerSupport');
const customerByPhoneService = require('./customerByPhoneService');

async function getCustomerByPhone(req, res) {
  try {
    const result = await customerByPhoneService.getCustomerByPhone({
      branchId: toInt(req.user?.branchId),
      rawPhone: req.params?.phone,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('❌ getCustomerByPhone error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาลูกค้า' });
  }
}

module.exports = {
  getCustomerByPhone,
};
