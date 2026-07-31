const service = require('./customerStaffUpdateService');

async function updateCustomerStaff(req, res) {
  try {
    const customer = await service.updateCustomerStaff({
      userContext: req.user || {},
      customerId: req.params.id,
      body: req.body || {},
    });
    return res.json(customer);
  } catch (error) {
    if (error?.status && error?.body) {
      return res.status(error.status).json(error.body);
    }
    console.error('❌ updateCustomerProfile error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตลูกค้า' });
  }
}

module.exports = {
  updateCustomerStaff,
};
