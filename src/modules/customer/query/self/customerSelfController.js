const customerSelfService = require('./customerSelfService');

async function getCustomerSelf(req, res) {
  try {
    const result = await customerSelfService.getCustomerSelf({
      userId: req.user?.id,
      role: req.user?.role,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('❌ getCustomerSelf error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูลลูกค้า' });
  }
}

module.exports = {
  getCustomerSelf,
};
